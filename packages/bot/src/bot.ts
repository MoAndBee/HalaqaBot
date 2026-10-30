import { Bot, type InputFile } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import type { UserFromGetMe } from "grammy/types";
import { ConvexHttpClient } from "@halakabot/db";
import type { Config } from "./config/environment";
import { MessageService } from "./services/message.service";
import { UserListService } from "./services/user-list.service";
import { ClassificationService } from "./services/classification.service";
import { BotActionsService } from "./services/bot-actions.service";
import { AdminSyncService } from "./services/admin-sync.service";
import { registerMessageHandler } from "./handlers/message.handler";
import { registerReactionHandler } from "./handlers/reaction.handler";
import { registerAutoClassifyHandler } from "./handlers/auto-classify.handler";
import { registerWebAppHandler } from "./handlers/webApp.handler";
import { registerChatMemberHandler } from "./handlers/chatMember.handler";
import { registerChannelDiscoveryHandler } from "./handlers/channelDiscovery.handler";
import { registerChannelFromChat } from "./services/channel-registry.service";

/**
 * Update types the bot handles, registered with Telegram by scripts/set-webhook.ts.
 * Changing this list only takes effect after re-running that script.
 */
export const ALLOWED_UPDATES = [
  "message",
  "message_reaction",
  "channel_post",
  "my_chat_member",
  "chat_member",
] as const;

export interface BotApp {
  bot: Bot;
  convex: ConvexHttpClient;
  config: Config;
  adminSyncService: AdminSyncService;
  botActions: BotActionsService;
}

/**
 * How long to keep retrying a Telegram call Telegram asked us to retry (429
 * with retry_after, or its own 5xx). Network failures are never retried: the
 * call may already have taken effect, and a dead network shouldn't hold up
 * the queue.
 */
export interface TelegramRetryPolicy {
  maxRetryAttempts: number;
  maxDelaySeconds: number;
}

/** Queue jobs have minutes to spare, so they wait out Telegram's limits. */
export const QUEUE_RETRY: TelegramRetryPolicy = { maxRetryAttempts: 3, maxDelaySeconds: 60 };
/** Web requests must answer before the Mini App gives up (30s). */
export const API_RETRY: TelegramRetryPolicy = { maxRetryAttempts: 1, maxDelaySeconds: 10 };

export interface BotAppOptions {
  registrationClosedPhoto: () => InputFile;
  retry: TelegramRetryPolicy;
  /** The bot's own getMe result, if already known; spares a call on startup. */
  botInfo?: UserFromGetMe;
}

/** Builds the bot with all handlers and services wired up. */
export function createBotApp(config: Config, options: BotAppOptions): BotApp {
  const convex = new ConvexHttpClient(config.convexUrl);
  const bot = new Bot(config.botToken, {
    botInfo: options.botInfo,
    client: config.telegramApiRoot ? { apiRoot: config.telegramApiRoot } : undefined,
  });
  // Telegram rate-limits bursts (e.g. about 20 messages a minute into one
  // group, which post-import probes can reach): wait out its retry_after
  // instead of failing the call. Also retries Telegram's own 5xx errors.
  bot.api.config.use(autoRetry({ ...options.retry, rethrowHttpErrors: true }));

  const messageService = new MessageService(convex, config.forwardChatId);
  const userListService = new UserListService(convex);
  const classificationService = new ClassificationService(config.groqApiKey, config.groqBaseUrl);
  const adminSyncService = new AdminSyncService(convex, bot.api);
  const botActions = new BotActionsService(
    bot,
    convex,
    config,
    messageService,
    classificationService,
    options.registrationClosedPhoto,
  );

  // Channel discovery goes first: it's pass-through middleware that registers
  // unknown channels/discussion groups from any channel post or group message
  // before the other handlers run.
  registerChannelDiscoveryHandler(bot, convex, adminSyncService);
  registerReactionHandler(bot, messageService, userListService, classificationService, convex, config);
  registerAutoClassifyHandler(bot, classificationService, messageService, userListService, convex, config);
  // Commands before the catch-all message handler, which doesn't pass messages
  // on: registered after it, /admin never ran.
  registerWebAppHandler(bot, convex, config);
  registerMessageHandler(bot, messageService, classificationService, convex);
  registerChatMemberHandler(bot, convex, adminSyncService);

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return { bot, convex, config, adminSyncService, botActions };
}

/**
 * Registers the configured channel, then syncs admins for every registered
 * channel. Seeding first means admins aren't locked out of the web app before
 * auto-discovery sees the channel's next post; the configured channel is also
 * passed as a fallback so it's synced even if the registry is still empty.
 */
export async function syncChannels(app: BotApp): Promise<void> {
  await registerChannelFromChat(app.bot.api, app.convex, app.config.channelId);
  await app.adminSyncService.fetchAndSyncAll([app.config.channelId]);
}
