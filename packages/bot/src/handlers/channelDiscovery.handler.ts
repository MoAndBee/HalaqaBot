import type { Bot, Context, NextFunction } from "grammy";
import type { ConvexHttpClient } from "@halakabot/db";
import { registerChannelFromChat } from "../services/channel-registry.service";
import type { AdminSyncService } from "../services/admin-sync.service";

// Chats we already resolved this process: value is when we last checked, so a
// group that later gets linked to a channel is re-checked instead of being
// ignored forever.
const RECHECK_SKIPPED_AFTER_MS = 10 * 60 * 1000;

/**
 * Passive channel discovery from live traffic.
 *
 * The Telegram Bot API has no way to enumerate the chats a bot belongs to, so
 * the registry can only learn about channels from updates. A bot that is an
 * admin of a channel receives a `channel_post` update for every post, and it
 * receives a `message` update for everything in a discussion group it belongs
 * to. Both are used here: the first update seen from an unknown chat resolves
 * the channel <-> discussion-group pairing via getChat and upserts it into the
 * registry, then immediately syncs that channel's admins so the web app picker
 * reflects it without waiting for the periodic sync.
 *
 * Registered as pass-through middleware (always calls next) ahead of the other
 * handlers.
 */
export function registerChannelDiscoveryHandler(
  bot: Bot,
  convex: ConvexHttpClient,
  adminSyncService: AdminSyncService,
) {
  const registeredChatIds = new Set<number>();
  const skippedCheckedAt = new Map<number, number>();

  const discover = async (ctx: Context, next: NextFunction) => {
    const chat = ctx.chat;
    const isDiscoverable =
      chat &&
      (chat.type === "channel" ||
        chat.type === "supergroup" ||
        chat.type === "group");

    if (isDiscoverable && !registeredChatIds.has(chat.id)) {
      const lastSkip = skippedCheckedAt.get(chat.id);
      if (lastSkip === undefined || Date.now() - lastSkip > RECHECK_SKIPPED_AFTER_MS) {
        try {
          const registered = await registerChannelFromChat(bot.api, convex, chat.id);
          if (registered) {
            registeredChatIds.add(chat.id);
            skippedCheckedAt.delete(chat.id);
            // Sync admins right away so getMyChannels picks up the new channel
            // without waiting for the periodic sync.
            await adminSyncService.fetchAndSync(registered.channelId);
          } else {
            skippedCheckedAt.set(chat.id, Date.now());
          }
        } catch (error) {
          console.error(`❌ Error auto-discovering chat ${chat.id}:`, error);
          skippedCheckedAt.set(chat.id, Date.now());
        }
      }
    }

    await next();
  };

  bot.on("channel_post", discover);
  bot.on("message", discover);
}
