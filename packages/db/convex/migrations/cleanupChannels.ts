import { internalMutation } from "../_generated/server";

/**
 * Deactivate bogus channels-registry rows where the discussion group itself
 * was registered as a "channel" (channelId === chatId) while a real channel
 * row already points at the same chat. Such rows make the web-app channel
 * picker show a duplicate entry whose channelId doesn't match any
 * channelAdmins records, so supervisor names render as raw user IDs and the
 * auto-assign flow misfires.
 *
 * Run once after deploy:
 *   bunx convex run migrations/cleanupChannels:cleanupChannels
 */
export const cleanupChannels = internalMutation({
  args: {},
  handler: async (ctx) => {
    const channels = await ctx.db.query("channels").collect();

    const realChannelChatIds = new Set(
      channels.filter((c) => c.channelId !== c.chatId).map((c) => c.chatId)
    );

    let deactivated = 0;
    for (const channel of channels) {
      if (
        channel.isActive &&
        channel.channelId === channel.chatId &&
        realChannelChatIds.has(channel.chatId)
      ) {
        await ctx.db.patch(channel._id, {
          isActive: false,
          updatedAt: Date.now(),
        });
        deactivated++;
        console.log(
          `Deactivated bogus channel row ${channel.channelId} (duplicate of a real channel for chat ${channel.chatId})`
        );
      }
    }

    console.log(`✅ Cleanup complete: ${deactivated} bogus rows deactivated`);
    return { deactivated };
  },
});
