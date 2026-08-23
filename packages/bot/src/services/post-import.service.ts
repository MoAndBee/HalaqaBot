import type { Api } from "grammy";
import type { Message } from "grammy/types";
import type { ConvexHttpClient, Doc, Id } from "@halakabot/db";
import { api } from "@halakabot/db";

/**
 * Resolves a pasted Telegram post link to the discussion-group message id that
 * `posts.postId` is keyed by, then registers the post.
 *
 * Posts are normally registered live, from the automatic forward Telegram drops
 * into the discussion group (see message.handler.ts). A post published before
 * the bot was made an admin never produced that update, so it has to be found
 * after the fact — and the Bot API offers no way to read channel history.
 *
 * What it does offer is forwarding: forwarding any message to a scratch chat
 * returns the full message, including `forward_origin` (the original chat, its
 * message id and its date). That is enough to inspect a message the bot never
 * saw, so every lookup here is a forward-and-delete probe.
 *
 * Two link shapes are handled:
 *
 *   - a link into the discussion group — the message id IS the post id, so one
 *     probe confirms it is the right post and reads its date.
 *
 *   - a link into the channel — the channel's message id is unrelated to the
 *     discussion group's, so the copy is located by binary-searching the group
 *     on message date, then scanning the neighbourhood for the auto-forward
 *     whose origin matches the channel post.
 */

/** Opening phrase of a turn-registration post; the same test the live handler uses. */
const REGISTRATION_PREFIX = "حللتم أهلا";

/** Ceiling on forward probes per import, so a bad link cannot spin forever. */
const MAX_PROBES = 60;

/** Pause between probes, to stay clear of Telegram's flood limits. */
const PROBE_DELAY_MS = 120;

/** How far around the date match to look for the auto-forward itself. */
const SCAN_BEFORE = 5;
const SCAN_AFTER = 25;

export type PostImportRecord = Doc<"postImports">;

interface Probe {
  messageId: number;
  /** Original send time of the message, in ms. */
  date: number;
  /** Set when the probed message originates from a channel post. */
  originChannelId?: number;
  originMessageId?: number;
  text?: string;
}

/** Raised for failures the admin can act on; the text is shown in the web app. */
class PostImportError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class PostImportService {
  private probeCount = 0;

  constructor(
    private api: Api,
    private convex: ConvexHttpClient,
    private forwardChatId: string,
  ) {}

  /**
   * Resolves one import request and records the outcome. Never throws: an
   * unresolvable link is reported back on the import record instead.
   */
  async run(record: PostImportRecord): Promise<void> {
    const importId: Id<"postImports"> = record._id;
    this.probeCount = 0;

    try {
      const resolved = await this.resolve(record);
      await this.convex.mutation(api.mutations.completePostImport, {
        importId,
        postId: resolved.postId,
        createdAt: resolved.createdAt,
        channelId: resolved.channelId,
      });
      console.log(
        `✅ Imported old post ${resolved.postId} in chat ${record.chatId} from ${record.link}`,
      );
    } catch (error) {
      const message =
        error instanceof PostImportError
          ? error.message
          : "تعذر الوصول إلى المنشور. تأكدي من أن البوت مشرف في القناة ومجموعة النقاش.";
      console.error(`❌ Post import failed for ${record.link}:`, error);
      await this.convex.mutation(api.mutations.failPostImport, {
        importId,
        error: message,
      });
    }
  }

  private async resolve(
    record: PostImportRecord,
  ): Promise<{ postId: number; createdAt: number; channelId?: number }> {
    const linkChatId = await this.resolveLinkChatId(record);

    if (linkChatId === record.chatId) {
      return await this.resolveFromDiscussionLink(record);
    }

    if (record.channelId !== undefined && linkChatId === record.channelId) {
      return await this.resolveFromChannelLink(record, record.channelId);
    }

    // The link may still be a channel link for this discussion group even when
    // the request carried no channel id — the probe below settles it.
    if (record.channelId === undefined) {
      return await this.resolveFromChannelLink(record, linkChatId);
    }

    throw new PostImportError(
      "هذا الرابط لا يخص القناة المحددة. اختاري القناة الصحيحة أو انسخي الرابط منها.",
    );
  }

  /** Turns a public @username link into a chat id; private links carry one already. */
  private async resolveLinkChatId(record: PostImportRecord): Promise<number> {
    if (record.linkChatId !== undefined) return record.linkChatId;
    if (!record.linkUsername) {
      throw new PostImportError("الرابط غير صالح.");
    }

    try {
      const chat = await this.api.getChat(`@${record.linkUsername}`);
      return chat.id;
    } catch {
      throw new PostImportError(
        `تعذر الوصول إلى @${record.linkUsername}. تأكدي من أن البوت عضو في القناة.`,
      );
    }
  }

  /**
   * The link already points at the discussion group, so the message id is the
   * post id — it only has to be confirmed as a registration post.
   */
  private async resolveFromDiscussionLink(record: PostImportRecord) {
    const probe = await this.probe(record.chatId, record.linkMessageId);
    if (!probe) {
      throw new PostImportError(
        "لم يتم العثور على رسالة بهذا الرابط في مجموعة النقاش.",
      );
    }

    if (probe.originChannelId === undefined) {
      throw new PostImportError(
        "هذا الرابط يشير إلى تعليق وليس إلى منشور الحلقة. انسخي رابط المنشور نفسه.",
      );
    }

    this.assertRegistrationPost(probe.text);

    return {
      postId: record.linkMessageId,
      createdAt: probe.date,
      channelId: probe.originChannelId,
    };
  }

  /**
   * The link points at the channel, whose message ids are unrelated to the
   * discussion group's. The post's date comes from probing the channel message;
   * the group is then searched for the copy Telegram forwarded at that moment.
   */
  private async resolveFromChannelLink(
    record: PostImportRecord,
    channelId: number,
  ) {
    const channelProbe = await this.probe(channelId, record.linkMessageId);
    if (!channelProbe) {
      throw new PostImportError(
        "لم يتم العثور على المنشور. تأكدي من الرابط ومن أن البوت مشرف في القناة.",
      );
    }
    this.assertRegistrationPost(channelProbe.text);

    const postId = await this.findDiscussionCopy(
      record.chatId,
      channelId,
      record.linkMessageId,
      channelProbe.date,
    );

    return { postId, createdAt: channelProbe.date, channelId };
  }

  /**
   * Locates the auto-forwarded copy of a channel post inside the discussion
   * group by binary-searching message ids on date, then scanning around the
   * crossing point for the copy whose origin matches the post.
   */
  private async findDiscussionCopy(
    chatId: number,
    channelId: number,
    channelMessageId: number,
    postDate: number,
  ): Promise<number> {
    const bounds = await this.convex.query(api.queries.getPostSearchBounds, {
      chatId,
      timestamp: postDate,
    });

    let low = bounds.lower ? bounds.lower.postId : 1;
    let high = bounds.upper ? bounds.upper.postId : await this.currentMaxMessageId(chatId);

    if (high < low) {
      throw new PostImportError(
        "تعذر تحديد موقع المنشور في مجموعة النقاش. جربي نسخ رابط المنشور من قسم التعليقات.",
      );
    }

    // Binary search for the first message at or after the post's date. Probes
    // land on ordinary comments too, which is fine — only their date is used.
    // Message ids and dates run in step, with one exception: a message someone
    // forwarded into the group reports the date of what it forwards. The scan
    // below absorbs the small misses that causes; a large one ends in the
    // "paste the comments link instead" error rather than a wrong post.
    let candidate = high;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const probe = await this.probeNear(chatId, mid, high);

      if (!probe) {
        // No probeable message left in [mid, high]: the target is below.
        high = mid - 1;
        continue;
      }

      const match = this.matchesPost(probe, channelId, channelMessageId);
      if (match) return probe.messageId;

      if (probe.date >= postDate) {
        candidate = probe.messageId;
        high = probe.messageId - 1;
      } else {
        low = probe.messageId + 1;
      }
    }

    // The auto-forward lands within moments of the post, so it sits next to the
    // date crossing — but comments on the previous post may be interleaved.
    for (let offset = -SCAN_BEFORE; offset <= SCAN_AFTER; offset++) {
      const messageId = candidate + offset;
      if (messageId < 1) continue;
      const probe = await this.probe(chatId, messageId);
      if (probe && this.matchesPost(probe, channelId, channelMessageId)) {
        return probe.messageId;
      }
    }

    throw new PostImportError(
      "لم يتم العثور على المنشور في مجموعة النقاش. تأكدي من أن التعليقات مفعّلة على المنشور، أو انسخي رابط المنشور من قسم التعليقات.",
    );
  }

  private matchesPost(probe: Probe, channelId: number, channelMessageId: number) {
    return (
      probe.originChannelId === channelId &&
      probe.originMessageId === channelMessageId
    );
  }

  /**
   * Probes `messageId`, stepping forward when an id has no message — ids are
   * skipped by deletions and service messages.
   */
  private async probeNear(
    chatId: number,
    messageId: number,
    limit: number,
  ): Promise<Probe | null> {
    for (let candidate = messageId; candidate <= limit; candidate++) {
      const probe = await this.probe(chatId, candidate);
      if (probe) return probe;
    }
    return null;
  }

  /**
   * Reads a message the bot never received by forwarding it to the scratch chat
   * and deleting the copy. Returns null when the message cannot be forwarded.
   */
  private async probe(chatId: number, messageId: number): Promise<Probe | null> {
    if (this.probeCount >= MAX_PROBES) {
      throw new PostImportError(
        "استغرق البحث وقتًا طويلاً. انسخي رابط المنشور من قسم التعليقات لاستيراده مباشرة.",
      );
    }
    this.probeCount++;
    if (this.probeCount > 1) await sleep(PROBE_DELAY_MS);

    let forwarded: Message;
    try {
      forwarded = await this.api.forwardMessage(this.forwardChatId, chatId, messageId);
    } catch {
      return null;
    }

    try {
      await this.api.deleteMessage(this.forwardChatId, forwarded.message_id);
    } catch (error) {
      console.warn("⚠️  Could not delete post-import probe:", error);
    }

    const origin = forwarded.forward_origin;
    const probe: Probe = {
      messageId,
      // forward_origin carries the original send time; the copy's own date is
      // the time of the probe and would break the search.
      date: (origin?.date ?? forwarded.date) * 1000,
      text: forwarded.text ?? forwarded.caption,
    };

    if (origin?.type === "channel") {
      probe.originChannelId = origin.chat.id;
      probe.originMessageId = origin.message_id;
    }

    return probe;
  }

  /**
   * Upper bound for the search: the id Telegram hands out right now. Sent and
   * deleted immediately, since the Bot API exposes no other way to ask.
   */
  private async currentMaxMessageId(chatId: number): Promise<number> {
    let marker: Message.TextMessage;
    try {
      marker = await this.api.sendMessage(chatId, "⏳");
    } catch {
      throw new PostImportError(
        "تعذر البحث في مجموعة النقاش. تأكدي من أن البوت عضو فيها ويستطيع إرسال الرسائل.",
      );
    }

    try {
      await this.api.deleteMessage(chatId, marker.message_id);
    } catch (error) {
      console.warn("⚠️  Could not delete post-import marker message:", error);
    }

    return marker.message_id;
  }

  private assertRegistrationPost(text: string | undefined) {
    if (!text?.trimStart().startsWith(REGISTRATION_PREFIX)) {
      throw new PostImportError(
        `هذا المنشور ليس منشور تسجيل حلقة (يبدأ بـ "${REGISTRATION_PREFIX}").`,
      );
    }
  }
}
