/**
 * An in-memory Telegram for one bot: users, channels with discussion groups,
 * messages and reactions, the slice of the Bot API the bot calls, and webhook
 * delivery that behaves like Telegram's (allowed_updates filtering, the secret
 * token header, max_connections, retries).
 *
 * Runtime-neutral (fetch + Web Crypto only), so it runs under Bun locally and
 * inside a Worker for preview deployments. Drive it through the methods below,
 * or over HTTP via server.ts.
 */
import type { Message, ReactionType, Update, User } from "grammy/types";
import { signInitData } from "./init-data";

export type MemberStatus = "creator" | "administrator" | "member" | "left" | "kicked";
type ChatKind = "private" | "group" | "supergroup" | "channel";

export interface SimUser extends User {
  /** "Forwarded messages" privacy: forwards show only the sender's name. */
  hideForwards?: boolean;
}

interface ChatInfo {
  id: number;
  type: ChatKind;
  title?: string;
  username?: string;
  linked_chat_id?: number;
  has_protected_content?: true;
}

interface ChatState {
  info: ChatInfo;
  members: Map<number, MemberStatus>;
  messages: Map<number, Message & { deleted?: boolean }>;
  nextMessageId: number;
  /** messageId -> userId -> that user's reactions */
  reactions: Map<number, Map<number, ReactionType[]>>;
  /** messageId -> the bot's own reaction */
  botReactions: Map<number, ReactionType[]>;
}

export interface WebhookConfig {
  url: string;
  secretToken?: string;
  allowedUpdates?: string[];
  maxConnections: number;
}

export interface ApiCall {
  method: string;
  params: Record<string, unknown>;
  ok: boolean;
  description?: string;
}

export interface Delivery {
  updateId: number;
  type: string;
  attempts: number;
  status: "delivered" | "failed";
  lastError?: string;
}

/** A Bot API error, returned to the bot as Telegram would. */
export class TelegramApiError extends Error {
  constructor(
    readonly errorCode: number,
    readonly description: string,
    readonly parameters?: { retry_after?: number },
  ) {
    super(description);
  }
}

/** Telegram's service account; automatic forwards into discussion groups come "from" it. */
const TELEGRAM_SERVICE_USER: User = { id: 777000, is_bot: false, first_name: "Telegram" };
/** Sender of an anonymous admin's messages, posting as the group itself. */
const GROUP_ANONYMOUS_BOT: User = { id: 1087968824, is_bot: true, first_name: "Group", username: "GroupAnonymousBot" };
/** Sender of messages someone posts as one of their channels. */
const CHANNEL_BOT: User = { id: 136817688, is_bot: true, first_name: "Channel", username: "Channel_Bot" };

const MAX_TEXT_LENGTH = 4096;
const MAX_CAPTION_LENGTH = 1024;

/** Updates Telegram withholds unless a webhook lists them in allowed_updates. */
const OPT_IN_UPDATES = new Set(["chat_member", "message_reaction", "message_reaction_count"]);

const ADMIN = new Set<MemberStatus>(["creator", "administrator"]);
const PRESENT = new Set<MemberStatus>(["creator", "administrator", "member"]);

export interface SimulatorOptions {
  botToken: string;
  botUsername?: string;
  /** Delay before re-sending an update the webhook rejected (ms). */
  retryDelayMs?: number;
  /** Attempts per update before it is dropped. */
  maxDeliveryAttempts?: number;
  /** Seconds since epoch; override to make tests deterministic. */
  now?: () => number;
  /**
   * Telegram-style flood limit on what the bot sends into one chat (messages,
   * photos, forwards): beyond `sends` per `windowMs`, calls fail with 429 and
   * a retry_after. Off by default.
   */
  rateLimit?: { sends: number; windowMs: number };
  /**
   * Where user and chat IDs start. Runs against a persistent database (a real
   * Convex deployment) pick fresh ranges so they don't meet earlier runs' data.
   */
  firstUserId?: number;
  firstChatId?: number;
}

export class TelegramSimulator {
  readonly botToken: string;
  readonly bot: User;
  readonly users = new Map<number, SimUser>();
  readonly chats = new Map<number, ChatState>();
  readonly apiCalls: ApiCall[] = [];
  readonly deliveries: Delivery[] = [];
  webhook: WebhookConfig | null = null;
  menuButton: unknown = null;

  private nextUserId: number;
  private nextChannelId: number;
  private nextUpdateId = 1;
  private pending: Update[] = [];
  private inFlight = 0;
  /** allowed_updates from the last getUpdates call, for bots that poll. */
  private pollingAllowedUpdates?: string[];
  private idleWaiters: Array<() => void> = [];
  private readonly retryDelayMs: number;
  private readonly maxDeliveryAttempts: number;
  private readonly now: () => number;
  private readonly rateLimit?: { sends: number; windowMs: number };
  /** chatId -> times (ms) of the bot's recent sends into it, for rateLimit. */
  private recentSends = new Map<number, number[]>();

  constructor(options: SimulatorOptions) {
    this.botToken = options.botToken;
    const botId = Number(options.botToken.split(":")[0]);
    if (!Number.isSafeInteger(botId)) throw new Error("Bot token must look like <id>:<secret>");
    this.bot = { id: botId, is_bot: true, first_name: "Halaqa Bot", username: options.botUsername ?? "halaqa_sim_bot" };
    this.users.set(botId, this.bot);
    this.retryDelayMs = options.retryDelayMs ?? 200;
    this.maxDeliveryAttempts = options.maxDeliveryAttempts ?? 5;
    this.now = options.now ?? (() => Math.floor(Date.now() / 1000));
    this.rateLimit = options.rateLimit;
    this.nextUserId = options.firstUserId ?? 100001;
    this.nextChannelId = options.firstChatId ?? -1001000000001;
  }

  // ---------------------------------------------------------------- world

  addUser(user: { first_name: string; last_name?: string; username?: string; id?: number; hideForwards?: boolean }): SimUser {
    const created: SimUser = { is_bot: false, ...user, id: user.id ?? this.nextUserId++ };
    this.users.set(created.id, created);
    return created;
  }

  /**
   * A channel and, by default, its linked discussion group, with the bot as an
   * admin of both and `ownerId` as their creator. Channel admins are made admins
   * of the group too, as is usual.
   */
  createChannel(options: {
    title: string;
    ownerId: number;
    adminIds?: number[];
    discussionGroup?: boolean;
    protectedContent?: boolean;
    username?: string;
  }): { channelId: number; groupId?: number } {
    const channelId = this.nextChannelId--;
    const channel = this.addChat({
      id: channelId,
      type: "channel",
      title: options.title,
      username: options.username,
      ...(options.protectedContent ? { has_protected_content: true } : {}),
    });
    channel.members.set(options.ownerId, "creator");
    channel.members.set(this.bot.id, "administrator");
    for (const id of options.adminIds ?? []) channel.members.set(id, "administrator");

    if (options.discussionGroup === false) return { channelId };

    const groupId = this.nextChannelId--;
    const group = this.addChat({
      id: groupId,
      type: "supergroup",
      title: `${options.title} – النقاش`,
      linked_chat_id: channelId,
      ...(options.protectedContent ? { has_protected_content: true } : {}),
    });
    channel.info.linked_chat_id = groupId;
    for (const [id, status] of channel.members) group.members.set(id, status);
    return { channelId, groupId };
  }

  /** The private chat between a user and the bot (its ID is the user's, as on Telegram). */
  privateChat(userId: number): number {
    const user = this.user(userId);
    if (!this.chats.has(userId)) {
      const chat = this.addChat({ id: userId, type: "private" });
      chat.members.set(userId, "member");
      chat.members.set(this.bot.id, "member");
      (chat.info as any).first_name = user.first_name;
    }
    return userId;
  }

  /** A group the bot can post in, e.g. the scratch chat it forwards messages to. */
  createGroup(options: { title: string; ownerId: number }): number {
    const id = this.nextChannelId--;
    const group = this.addChat({ id, type: "supergroup", title: options.title });
    group.members.set(options.ownerId, "creator");
    group.members.set(this.bot.id, "administrator");
    return id;
  }

  /**
   * Publishes a channel post. Telegram sends the bot a channel_post, then copies
   * the post into the linked discussion group as an automatic forward.
   *
   * `silent` publishes it as if before the bot became an admin: the messages
   * exist, but the bot is never told about them (what post imports are for).
   */
  postToChannel(
    channelId: number,
    text: string,
    options: { silent?: boolean } = {},
  ): { channelMessage: Message; groupMessage?: Message } {
    const channel = this.chat(channelId);
    if (channel.info.type !== "channel") throw new Error(`${channelId} is not a channel`);
    const channelMessage = this.store(channel, { sender_chat: this.chatRef(channel), text } as Partial<Message>);
    if (!options.silent) this.emit(channel, { channel_post: channelMessage } as Partial<Update>);

    const groupId = channel.info.linked_chat_id;
    if (groupId === undefined) return { channelMessage };
    const group = this.chat(groupId);
    const groupMessage = this.store(group, {
      from: TELEGRAM_SERVICE_USER,
      sender_chat: this.chatRef(channel),
      is_automatic_forward: true,
      forward_origin: {
        type: "channel",
        chat: this.chatRef(channel),
        message_id: channelMessage.message_id,
        date: channelMessage.date,
      },
      text,
    } as Partial<Message>);
    if (!options.silent) this.emit(group, { message: groupMessage } as Partial<Update>);
    return { channelMessage, groupMessage };
  }

  /**
   * A user sends a message (joining the chat if needed), optionally as a reply.
   * `deferred` stores it without telling the bot yet — call releaseDeferred() later to
   * have the update arrive late, e.g. after a reaction to it.
   */
  sendUserMessage(
    chatId: number,
    userId: number,
    text: string,
    options: { replyTo?: number; deferred?: boolean } = {},
  ): Message {
    const chat = this.chat(chatId);
    const user = this.user(userId);
    if (!PRESENT.has(chat.members.get(userId) ?? "left")) chat.members.set(userId, "member");
    return this.postMessage(chat, { from: this.userRef(user) }, text, options);
  }

  /**
   * A message sent as a chat rather than a person: as the group itself (an
   * anonymous admin; Telegram sends it from GroupAnonymousBot) or as a channel
   * the sender owns (from Channel_Bot).
   */
  sendAsChat(chatId: number, senderChatId: number, text: string, options: { replyTo?: number } = {}): Message {
    const chat = this.chat(chatId);
    const sender = this.chat(senderChatId);
    return this.postMessage(
      chat,
      { from: senderChatId === chatId ? GROUP_ANONYMOUS_BOT : CHANNEL_BOT, sender_chat: this.chatRef(sender) },
      text,
      options,
    );
  }

  /** Tells the bot about a message stored with `deferred`. */
  releaseDeferred(chatId: number, messageId: number): void {
    const chat = this.chat(chatId);
    this.emit(chat, { message: this.message(chat, messageId) } as Partial<Update>);
  }

  private postMessage(
    chat: ChatState,
    sender: Partial<Message>,
    text: string,
    options: { replyTo?: number; deferred?: boolean },
  ): Message {
    // Telegram marks a leading /command so bots can route it.
    const command = text.match(/^\/[A-Za-z0-9_]+(@[A-Za-z0-9_]+)?/);
    const message = this.store(chat, {
      ...sender,
      text,
      ...(command ? { entities: [{ type: "bot_command", offset: 0, length: command[0].length }] } : {}),
      ...this.replyFields(chat, options.replyTo),
    } as Partial<Message>);
    if (!options.deferred) this.emit(chat, { message } as Partial<Update>);
    return message;
  }

  /**
   * reply_to_message, plus message_thread_id for comments: in a discussion
   * group, replies under a channel post share the post's thread.
   */
  private replyFields(chat: ChatState, replyTo: number | undefined): Partial<Message> {
    if (replyTo === undefined) return {};
    const target = this.message(chat, replyTo);
    const thread = target.is_automatic_forward ? target.message_id : target.message_thread_id;
    return {
      reply_to_message: this.replyTarget(chat, replyTo),
      ...(thread !== undefined ? { message_thread_id: thread } : {}),
    } as Partial<Message>;
  }

  /** A user sets their reactions on a message (an empty list removes them). */
  react(chatId: number, messageId: number, userId: number, emojis: string[]): void {
    const chat = this.chat(chatId);
    const user = this.user(userId);
    this.message(chat, messageId);
    const byUser = chat.reactions.get(messageId) ?? new Map<number, ReactionType[]>();
    chat.reactions.set(messageId, byUser);
    const oldReaction = byUser.get(userId) ?? [];
    const newReaction = emojis.map((emoji) => ({ type: "emoji", emoji }) as ReactionType);
    byUser.set(userId, newReaction);
    if (chat.info.type === "channel") {
      // Channel reactions are anonymous: only the new totals are reported.
      const totals = new Map<string, number>();
      for (const reactions of byUser.values()) {
        for (const r of reactions) if (r.type === "emoji") totals.set(r.emoji, (totals.get(r.emoji) ?? 0) + 1);
      }
      this.emit(chat, {
        message_reaction_count: {
          chat: this.chatRef(chat),
          message_id: messageId,
          date: this.now(),
          reactions: [...totals].map(([emoji, total_count]) => ({ type: { type: "emoji", emoji }, total_count })),
        },
      } as Partial<Update>);
      return;
    }
    this.emit(chat, {
      message_reaction: {
        chat: this.chatRef(chat),
        message_id: messageId,
        user: this.userRef(user),
        date: this.now(),
        old_reaction: oldReaction,
        new_reaction: newReaction,
      },
    } as Partial<Update>);
  }

  /**
   * Changes a member's status. Telegram reports changes to the bot itself as
   * my_chat_member and everyone else's as chat_member.
   */
  setMemberStatus(chatId: number, userId: number, status: MemberStatus, byUserId?: number): void {
    const chat = this.chat(chatId);
    const user = this.user(userId);
    const oldStatus = chat.members.get(userId) ?? "left";
    chat.members.set(userId, status);
    const by = byUserId ?? [...chat.members].find(([, s]) => s === "creator")?.[0] ?? userId;
    const change = {
      chat: this.chatRef(chat),
      from: this.userRef(this.user(by)),
      date: this.now(),
      old_chat_member: this.memberObject(user, oldStatus),
      new_chat_member: this.memberObject(user, status),
    };
    this.emit(chat, userId === this.bot.id ? { my_chat_member: change } : { chat_member: change }, {
      // Telegram tells the bot about its own membership even after removal.
      evenIfBotAbsent: userId === this.bot.id,
    });
  }

  /** Signed initData for opening the Mini App as `userId`. */
  async miniAppInitData(userId: number): Promise<string> {
    const { id, first_name, last_name, username } = this.user(userId);
    return signInitData(this.botToken, { id, first_name, last_name, username }, this.now());
  }

  /** Messages currently in a chat, oldest first (deleted ones left out). */
  history(chatId: number): Message[] {
    return [...this.chat(chatId).messages.values()].filter((m) => !m.deleted);
  }

  botReactionsOn(chatId: number, messageId: number): ReactionType[] {
    return this.chat(chatId).botReactions.get(messageId) ?? [];
  }

  /** Resolves once every queued update has been delivered or fetched (or given up on). */
  whenDelivered(): Promise<void> {
    if (this.pending.length === 0 && this.inFlight === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  get pendingUpdateCount(): number {
    return this.pending.length + this.inFlight;
  }

  // -------------------------------------------------------------- Bot API

  /** Executes a Bot API method as the bot. Throws TelegramApiError for API errors. */
  async callApi(method: string, params: Record<string, unknown>): Promise<unknown> {
    const call: ApiCall = { method, params, ok: true };
    this.apiCalls.push(call);
    try {
      const handler = (this.methods as Record<string, ((p: any) => unknown) | undefined>)[method];
      if (!handler) throw new TelegramApiError(404, "Not Found: method not found");
      return await handler(params);
    } catch (error) {
      call.ok = false;
      call.description = error instanceof TelegramApiError ? error.description : String(error);
      throw error;
    }
  }

  private methods = {
    getMe: () => ({
      ...this.bot,
      can_join_groups: true,
      can_read_all_group_messages: true,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    }),

    setWebhook: (p: { url: string; secret_token?: string; allowed_updates?: string[]; max_connections?: number; drop_pending_updates?: boolean }) => {
      if (!p.url) {
        this.webhook = null;
        return true;
      }
      this.webhook = {
        url: p.url,
        secretToken: p.secret_token,
        // Telegram keeps the previous list when a call doesn't name one.
        allowedUpdates: p.allowed_updates ?? this.webhook?.allowedUpdates,
        maxConnections: p.max_connections ?? 40,
      };
      if (p.drop_pending_updates) this.pending = [];
      this.pump();
      return true;
    },

    deleteWebhook: (p: { drop_pending_updates?: boolean }) => {
      this.webhook = null;
      if (p.drop_pending_updates) this.pending = [];
      return true;
    },

    getUpdates: async (p: { offset?: number; limit?: number; timeout?: number; allowed_updates?: string[] }) => {
      if (this.webhook) {
        throw new TelegramApiError(
          409,
          "Conflict: can't use getUpdates method while webhook is active; use deleteWebhook to delete the webhook first",
        );
      }
      if (p.allowed_updates) this.pollingAllowedUpdates = p.allowed_updates;
      const deadline = Date.now() + (p.timeout ?? 0) * 1000;
      while (true) {
        // Fetching with an offset confirms everything before it.
        if (p.offset !== undefined) this.pending = this.pending.filter((u) => u.update_id >= p.offset!);
        this.pending = this.pending.filter((u) => this.allowsType(updateType(u), this.pollingAllowedUpdates));
        this.notifyIfIdle();
        if (this.pending.length > 0 || Date.now() >= deadline) return this.pending.slice(0, p.limit ?? 100);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    },

    getWebhookInfo: () => {
      const lastFailure = [...this.deliveries].reverse().find((d) => d.lastError);
      return {
        url: this.webhook?.url ?? "",
        has_custom_certificate: false,
        pending_update_count: this.pendingUpdateCount,
        max_connections: this.webhook?.maxConnections,
        allowed_updates: this.webhook?.allowedUpdates,
        ...(lastFailure ? { last_error_date: this.now(), last_error_message: lastFailure.lastError } : {}),
      };
    },

    setChatMenuButton: (p: { menu_button?: unknown }) => {
      this.menuButton = p.menu_button ?? null;
      return true;
    },

    getChat: (p: { chat_id: number | string }) => {
      const chat = this.resolveChat(p.chat_id);
      // A private chat is invisible to a bot that isn't in it; public ones aren't.
      if (!chat.info.username && !PRESENT.has(chat.members.get(this.bot.id) ?? "left")) {
        throw new TelegramApiError(400, "Bad Request: chat not found");
      }
      return { ...chat.info, accent_color_id: 0, max_reaction_count: 11, accepted_gift_types: {} };
    },

    getChatMember: (p: { chat_id: number | string; user_id: number }) => {
      const chat = this.resolveChat(p.chat_id);
      this.requireBotPresent(chat);
      const user = this.users.get(p.user_id);
      if (!user) throw new TelegramApiError(400, "Bad Request: user not found");
      return this.memberObject(user, chat.members.get(user.id) ?? "left");
    },

    getChatAdministrators: (p: { chat_id: number | string }) => {
      const chat = this.resolveChat(p.chat_id);
      this.requireBotPresent(chat);
      return [...chat.members]
        .filter(([, status]) => ADMIN.has(status))
        .map(([id, status]) => this.memberObject(this.user(id), status));
    },

    sendMessage: (p: { chat_id: number | string; text?: string; reply_markup?: unknown } & ReplyParams) => {
      const chat = this.resolveChat(p.chat_id);
      this.requireBotCanPost(chat);
      if (!p.text || !String(p.text).trim()) throw new TelegramApiError(400, "Bad Request: message text is empty");
      if (String(p.text).length > MAX_TEXT_LENGTH) throw new TelegramApiError(400, "Bad Request: message is too long");
      return this.storeBotMessage(
        chat,
        { text: String(p.text), ...(p.reply_markup ? { reply_markup: p.reply_markup } : {}) } as Partial<Message>,
        p,
      );
    },

    sendPhoto: (p: { chat_id: number | string; photo?: unknown; caption?: string } & ReplyParams) => {
      const chat = this.resolveChat(p.chat_id);
      this.requireBotCanPost(chat);
      const size = p.photo instanceof Uint8Array ? p.photo.byteLength : undefined;
      if (p.photo === undefined || (typeof p.photo !== "string" && size === undefined)) {
        throw new TelegramApiError(400, "Bad Request: there is no photo in the request");
      }
      if (p.caption && String(p.caption).length > MAX_CAPTION_LENGTH) {
        throw new TelegramApiError(400, "Bad Request: message caption is too long");
      }
      const fileId = typeof p.photo === "string" ? p.photo : `sim-photo-${crypto.randomUUID()}`;
      return this.storeBotMessage(
        chat,
        {
          photo: [{ file_id: fileId, file_unique_id: fileId, width: 800, height: 600, file_size: size }],
          ...(p.caption ? { caption: p.caption } : {}),
        },
        p,
      );
    },

    deleteMessage: (p: { chat_id: number | string; message_id: number }) => {
      const chat = this.resolveChat(p.chat_id);
      this.requireBotPresent(chat);
      const message = chat.messages.get(p.message_id);
      if (!message || message.deleted) throw new TelegramApiError(400, "Bad Request: message to delete not found");
      const own = message.from?.id === this.bot.id;
      if (!own && !ADMIN.has(chat.members.get(this.bot.id) ?? "left")) {
        throw new TelegramApiError(400, "Bad Request: message can't be deleted");
      }
      message.deleted = true;
      return true;
    },

    setMessageReaction: (p: { chat_id: number | string; message_id: number; reaction?: ReactionType[] }) => {
      const chat = this.resolveChat(p.chat_id);
      this.requireBotPresent(chat);
      const message = chat.messages.get(p.message_id);
      if (!message || message.deleted) throw new TelegramApiError(400, "Bad Request: MESSAGE_ID_INVALID");
      chat.botReactions.set(p.message_id, p.reaction ?? []);
      return true;
    },

    forwardMessage: (p: { chat_id: number | string; from_chat_id: number | string; message_id: number }) => {
      const source = this.resolveChat(p.from_chat_id);
      this.requireBotPresent(source);
      const target = this.resolveChat(p.chat_id);
      this.requireBotCanPost(target);
      const original = source.messages.get(p.message_id);
      if (!original || original.deleted) throw new TelegramApiError(400, "Bad Request: message to forward not found");
      if (source.info.has_protected_content) {
        throw new TelegramApiError(400, "Bad Request: message can't be forwarded");
      }
      return this.storeBotMessage(target, {
        forward_origin: this.forwardOrigin(source, original),
        ...(original.text !== undefined ? { text: original.text } : {}),
        ...(original.caption !== undefined ? { caption: original.caption } : {}),
        ...(original.photo ? { photo: original.photo } : {}),
      } as Partial<Message>);
    },
  };

  // ------------------------------------------------------------- snapshots

  /** Everything needed to rebuild this world later (pending deliveries aside). */
  snapshot(): SimulatorSnapshot {
    return {
      users: [...this.users.values()],
      chats: [...this.chats.values()].map((c) => ({
        info: c.info,
        members: [...c.members],
        messages: [...c.messages.values()],
        nextMessageId: c.nextMessageId,
        reactions: [...c.reactions].map(([id, byUser]) => [id, [...byUser]] as const),
        botReactions: [...c.botReactions],
      })),
      nextUserId: this.nextUserId,
      nextChannelId: this.nextChannelId,
      nextUpdateId: this.nextUpdateId,
      webhook: this.webhook,
      menuButton: this.menuButton,
    };
  }

  /** Replaces this world with a snapshot's. */
  load(snapshot: SimulatorSnapshot): void {
    this.users.clear();
    for (const user of snapshot.users) this.users.set(user.id, user);
    this.chats.clear();
    for (const c of snapshot.chats) {
      this.chats.set(c.info.id, {
        info: c.info,
        members: new Map(c.members),
        messages: new Map(c.messages.map((m) => [m.message_id, m])),
        nextMessageId: c.nextMessageId,
        reactions: new Map(c.reactions.map(([id, byUser]) => [id, new Map(byUser)])),
        botReactions: new Map(c.botReactions),
      });
    }
    this.nextUserId = snapshot.nextUserId;
    this.nextChannelId = snapshot.nextChannelId;
    this.nextUpdateId = snapshot.nextUpdateId;
    this.webhook = snapshot.webhook;
    this.menuButton = snapshot.menuButton;
  }

  // -------------------------------------------------------------- helpers

  private addChat(info: ChatInfo): ChatState {
    const state: ChatState = {
      info,
      members: new Map(),
      messages: new Map(),
      nextMessageId: 1,
      reactions: new Map(),
      botReactions: new Map(),
    };
    this.chats.set(info.id, state);
    return state;
  }

  chat(chatId: number): ChatState {
    const chat = this.chats.get(chatId);
    if (!chat) throw new Error(`No simulated chat ${chatId}`);
    return chat;
  }

  user(userId: number): SimUser {
    const user = this.users.get(userId);
    if (!user) throw new Error(`No simulated user ${userId}`);
    return user;
  }

  private resolveChat(chatId: number | string): ChatState {
    const chat =
      typeof chatId === "string" && chatId.startsWith("@")
        ? [...this.chats.values()].find((c) => c.info.username === chatId.slice(1))
        : this.chats.get(Number(chatId));
    if (!chat) throw new TelegramApiError(400, "Bad Request: chat not found");
    return chat;
  }

  private requireBotPresent(chat: ChatState): void {
    if (!PRESENT.has(chat.members.get(this.bot.id) ?? "left")) {
      throw new TelegramApiError(
        403,
        `Forbidden: bot is not a member of the ${chat.info.type === "channel" ? "channel" : "supergroup"} chat`,
      );
    }
  }

  private requireBotCanPost(chat: ChatState): void {
    this.requireBotPresent(chat);
    if (this.rateLimit) {
      const now = Date.now();
      const recent = (this.recentSends.get(chat.info.id) ?? []).filter((t) => now - t < this.rateLimit!.windowMs);
      if (recent.length >= this.rateLimit.sends) {
        const retryAfter = Math.max(1, Math.ceil((recent[0]! + this.rateLimit.windowMs - now) / 1000));
        throw new TelegramApiError(429, `Too Many Requests: retry after ${retryAfter}`, { retry_after: retryAfter });
      }
      recent.push(now);
      this.recentSends.set(chat.info.id, recent);
    }
    if (chat.info.type === "channel" && !ADMIN.has(chat.members.get(this.bot.id) ?? "left")) {
      throw new TelegramApiError(400, "Bad Request: need administrator rights in the channel chat");
    }
  }

  private message(chat: ChatState, messageId: number): Message {
    const message = chat.messages.get(messageId);
    if (!message || message.deleted) throw new Error(`No message ${messageId} in chat ${chat.info.id}`);
    return message;
  }

  private chatRef(chat: ChatState) {
    const { id, type, title, username } = chat.info;
    return { id, type, ...(title ? { title } : {}), ...(username ? { username } : {}) } as any;
  }

  private userRef(user: SimUser): User {
    const { hideForwards: _hidden, ...ref } = user;
    return ref;
  }

  private memberObject(user: SimUser, status: MemberStatus): any {
    const base = { user: this.userRef(user), status };
    if (status === "administrator") {
      return {
        ...base,
        can_be_edited: false,
        is_anonymous: false,
        can_manage_chat: true,
        can_delete_messages: true,
        can_manage_video_chats: true,
        can_restrict_members: true,
        can_promote_members: false,
        can_change_info: true,
        can_invite_users: true,
        can_post_stories: false,
        can_edit_stories: false,
        can_delete_stories: false,
      };
    }
    if (status === "creator") return { ...base, is_anonymous: false };
    if (status === "kicked") return { ...base, until_date: 0 };
    return base;
  }

  /** The replied-to message as Telegram embeds it: one level deep. */
  private replyTarget(chat: ChatState, messageId: number): Message {
    const { reply_to_message: _nested, deleted: _deleted, ...target } = this.message(chat, messageId) as any;
    return target;
  }

  private forwardOrigin(source: ChatState, original: Message): any {
    if (original.forward_origin) return original.forward_origin;
    if (source.info.type === "channel") {
      return { type: "channel", chat: this.chatRef(source), message_id: original.message_id, date: original.date };
    }
    const sender = original.from ? this.users.get(original.from.id) : undefined;
    if (sender?.hideForwards) {
      return { type: "hidden_user", sender_user_name: [sender.first_name, sender.last_name].filter(Boolean).join(" "), date: original.date };
    }
    return { type: "user", sender_user: original.from, date: original.date };
  }

  private store(chat: ChatState, fields: Partial<Message>): Message {
    const message = {
      message_id: chat.nextMessageId++,
      date: this.now(),
      chat: this.chatRef(chat),
      ...fields,
      ...(chat.info.has_protected_content ? { has_protected_content: true } : {}),
    } as Message;
    chat.messages.set(message.message_id, message);
    return message;
  }

  private storeBotMessage(chat: ChatState, fields: Partial<Message>, reply: ReplyParams = {}): Message {
    const replyTo = reply.reply_parameters?.message_id ?? reply.reply_to_message_id;
    let replyFields: Partial<Message> = {};
    if (replyTo !== undefined) {
      const target = chat.messages.get(Number(replyTo));
      if (target && !target.deleted) {
        replyFields = this.replyFields(chat, Number(replyTo));
      } else if (!(reply.reply_parameters?.allow_sending_without_reply ?? reply.allow_sending_without_reply)) {
        throw new TelegramApiError(400, "Bad Request: message to be replied not found");
      }
    }
    return this.store(chat, {
      from: this.userRef(this.bot),
      ...fields,
      ...replyFields,
    } as Partial<Message>);
  }

  // ------------------------------------------------------------- delivery

  /** Queues an update for the bot, if Telegram would send it. */
  private emit(chat: ChatState, payload: Partial<Update>, options: { evenIfBotAbsent?: boolean } = {}): void {
    const type = Object.keys(payload)[0]!;
    const botStatus = chat.members.get(this.bot.id) ?? "left";
    if (!options.evenIfBotAbsent && !PRESENT.has(botStatus)) return;
    // Bots see channel posts, reactions and others' membership changes only as admins.
    const needsAdmin = type === "channel_post" || type === "message_reaction" || type === "chat_member";
    if (needsAdmin && !ADMIN.has(botStatus)) return;
    if (this.webhook && !this.allows(type)) return;

    this.pending.push({ update_id: this.nextUpdateId++, ...payload } as Update);
    this.pump();
  }

  private allows(type: string): boolean {
    return this.allowsType(type, this.webhook?.allowedUpdates);
  }

  private allowsType(type: string, allowed: string[] | undefined): boolean {
    if (!allowed || allowed.length === 0) return !OPT_IN_UPDATES.has(type);
    return allowed.includes(type);
  }

  private notifyIfIdle(): void {
    if (this.pending.length === 0 && this.inFlight === 0) {
      for (const resolve of this.idleWaiters.splice(0)) resolve();
    }
  }

  private pump(): void {
    const webhook = this.webhook;
    while (webhook && this.inFlight < webhook.maxConnections && this.pending.length > 0) {
      const update = this.pending.shift()!;
      this.inFlight++;
      void this.deliver(webhook, update).finally(() => {
        this.inFlight--;
        this.pump();
        this.notifyIfIdle();
      });
    }
  }

  private async deliver(webhook: WebhookConfig, update: Update): Promise<void> {
    const record: Delivery = {
      updateId: update.update_id,
      type: updateType(update),
      attempts: 0,
      status: "failed",
    };
    this.deliveries.push(record);
    while (record.attempts < this.maxDeliveryAttempts) {
      record.attempts++;
      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(webhook.secretToken ? { "X-Telegram-Bot-Api-Secret-Token": webhook.secretToken } : {}),
          },
          body: JSON.stringify(update),
        });
        if (response.ok) {
          record.status = "delivered";
          return;
        }
        record.lastError = `Wrong response from the webhook: ${response.status} ${response.statusText}`;
      } catch (error) {
        record.lastError = `Connection failed: ${error instanceof Error ? error.message : String(error)}`;
      }
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * record.attempts));
    }
  }
}

export interface SimulatorSnapshot {
  users: SimUser[];
  chats: Array<{
    info: ChatInfo;
    members: Array<[number, MemberStatus]>;
    messages: Array<Message & { deleted?: boolean }>;
    nextMessageId: number;
    reactions: ReadonlyArray<readonly [number, Array<[number, ReactionType[]]>]>;
    botReactions: Array<[number, ReactionType[]]>;
  }>;
  nextUserId: number;
  nextChannelId: number;
  nextUpdateId: number;
  webhook: WebhookConfig | null;
  menuButton: unknown;
}

function updateType(update: Update): string {
  return Object.keys(update).find((key) => key !== "update_id")!;
}

interface ReplyParams {
  reply_to_message_id?: number;
  allow_sending_without_reply?: boolean;
  reply_parameters?: { message_id: number; allow_sending_without_reply?: boolean };
}
