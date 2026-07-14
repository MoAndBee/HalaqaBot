import { internalMutation } from "../_generated/server";

/**
 * Bootstrap the channels registry from historical data.
 *
 * The registry is normally populated by auto-discovery from live traffic, but
 * that only fires when the bot next processes a channel post/comment. Because
 * getMyChannels gates the whole web app (0 channels -> unauthorized), we seed
 * the existing channel<->chat mapping here so admins aren't locked out
 * immediately after deploy.
 *
 * messageAuthors rows carry both channelId and chatId (for comments on posts),
 * so we derive the distinct pairs from there. Run once after deploy:
 *   bunx convex run migrations/seedChannels:seedChannels
 */
export const seedChannels = internalMutation({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("messageAuthors").collect();

    // Collect distinct channelId -> chatId pairs where both are known.
    const pairs = new Map<number, number>();
    for (const msg of messages) {
      if (msg.channelId !== undefined && msg.channelId !== null) {
        // Prefer the first seen chatId for a given channel.
        if (!pairs.has(msg.channelId)) {
          pairs.set(msg.channelId, msg.chatId);
        }
      }
    }

    // Drop pairs where the discussion group itself was recorded as the
    // "channel" (channelId === chatId) while a real channel maps to the same
    // chat — those are misattributed rows, not real channels.
    const realChannelChatIds = new Set(
      [...pairs.entries()]
        .filter(([channelId, chatId]) => channelId !== chatId)
        .map(([, chatId]) => chatId)
    );
    for (const [channelId, chatId] of [...pairs.entries()]) {
      if (channelId === chatId && realChannelChatIds.has(chatId)) {
        pairs.delete(channelId);
      }
    }

    const now = Date.now();
    let created = 0;
    let skipped = 0;

    for (const [channelId, chatId] of pairs) {
      const existing = await ctx.db
        .query("channels")
        .withIndex("by_channel", (q) => q.eq("channelId", channelId))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("channels", {
        channelId,
        chatId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      created++;
      console.log(`Seeded channel ${channelId} -> chat ${chatId}`);
    }

    console.log(
      `✅ Seed complete: ${created} channels created, ${skipped} already existed`
    );
    return { pairsFound: pairs.size, created, skipped };
  },
});
