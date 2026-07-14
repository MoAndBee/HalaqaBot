import type { Bot, Context } from "grammy";
import type { ConvexHttpClient } from "@halakabot/db";
import { registerChannelFromChat } from "../services/channel-registry.service";

// Statuses that mean the bot is present and able to serve the chat.
const PRESENT_STATUSES = new Set(["member", "administrator", "creator"]);
// Statuses that mean the bot has been removed from the chat.
const ABSENT_STATUSES = new Set(["left", "kicked"]);

/**
 * Register the bot's own membership-change handler. When the bot is added to (or
 * promoted in) a channel or its linked discussion group, we register the channel
 * in the registry immediately - no need to wait for the first post. When the bot
 * is removed, we mark the channel inactive so it drops out of the picker.
 */
export function registerChatMemberHandler(bot: Bot, convex: ConvexHttpClient) {
  bot.on("my_chat_member", async (ctx: Context) => {
    const update = ctx.myChatMember;
    if (!update) return;

    const chat = update.chat;
    const oldStatus = update.old_chat_member.status;
    const newStatus = update.new_chat_member.status;

    console.log(
      `👤 Bot membership changed in chat ${chat.id} (${chat.type}): ` +
        `${oldStatus} -> ${newStatus}`,
    );

    const nowPresent = PRESENT_STATUSES.has(newStatus);
    const nowAbsent = ABSENT_STATUSES.has(newStatus);

    // Ignore no-op transitions we don't care about (e.g. restricted).
    if (!nowPresent && !nowAbsent) return;

    // Only act when presence actually changed, to avoid redundant work on
    // permission-only updates (e.g. administrator rights changing).
    const wasPresent = PRESENT_STATUSES.has(oldStatus);
    if (nowPresent && wasPresent) return;

    try {
      await registerChannelFromChat(bot.api, convex, chat.id, {
        isActive: nowPresent,
      });
    } catch (error) {
      console.error("❌ Error handling my_chat_member update:", error);
    }
  });
}
