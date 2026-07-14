import type { Api } from "grammy";
import type { ConvexHttpClient } from "@halakabot/db";
import { api } from "@halakabot/db";

/**
 * Resolve the channelId <-> chatId pairing for a given Telegram chat and upsert
 * it into the channels registry.
 *
 * A "channel" (broadcast) and its linked "supergroup" (discussion group) are two
 * different chats. We accept the id of either one, ask Telegram which is linked
 * to it, and normalize to { channelId, chatId } so the registry is consistent
 * regardless of which chat the bot was added to.
 *
 * - Given a channel: channelId = id, chatId = its linked discussion group
 *   (falls back to the channel id if there is no linked group).
 * - Given a supergroup: chatId = id, channelId = its linked channel. If the
 *   group has no linked channel it isn't part of our model, so we skip it.
 * - Any other chat type (private, basic group) is skipped.
 *
 * @returns true if a channel row was upserted, false if the chat was skipped.
 */
export async function registerChannelFromChat(
  telegramApi: Api,
  convex: ConvexHttpClient,
  chatId: number,
  opts: { isActive?: boolean } = {},
): Promise<boolean> {
  const isActive = opts.isActive ?? true;

  let chat;
  try {
    chat = await telegramApi.getChat(chatId);
  } catch (error) {
    console.error(`❌ Error resolving chat ${chatId} for registry:`, error);
    return false;
  }

  const type = (chat as { type?: string }).type;
  const title = (chat as { title?: string }).title;
  const linkedChatId = (chat as { linked_chat_id?: number }).linked_chat_id;

  let resolvedChannelId: number;
  let resolvedChatId: number;

  if (type === "channel") {
    resolvedChannelId = chatId;
    resolvedChatId = linkedChatId ?? chatId;
    if (linkedChatId === undefined) {
      console.warn(
        `⚠️  Channel ${chatId} has no linked discussion group; ` +
          `using chatId = channelId as a fallback.`,
      );
    }
  } else if (type === "supergroup" || type === "group") {
    if (linkedChatId === undefined) {
      console.log(
        `⏭️  Chat ${chatId} (${type}) has no linked channel - not part of the ` +
          `channel model, skipping registry.`,
      );
      return false;
    }
    resolvedChatId = chatId;
    resolvedChannelId = linkedChatId;
  } else {
    console.log(`⏭️  Chat ${chatId} (type ${type}) is not a channel/group - skipping registry.`);
    return false;
  }

  try {
    await convex.mutation(api.mutations.upsertChannel, {
      channelId: resolvedChannelId,
      chatId: resolvedChatId,
      title,
      isActive,
    });
    console.log(
      `✅ Registered channel ${resolvedChannelId} -> chat ${resolvedChatId}` +
        (isActive ? "" : " (inactive)"),
    );
    return true;
  } catch (error) {
    console.error(`❌ Error upserting channel ${resolvedChannelId} to registry:`, error);
    return false;
  }
}
