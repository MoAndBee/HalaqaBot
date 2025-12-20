import { internalMutation } from "../_generated/server";

/**
 * Migration: Split userLists table into turnQueue and participationHistory
 *
 * This migration:
 * 1. Reads all entries from userLists
 * 2. Active users (no completedAt) → insert into turnQueue
 * 3. Completed users (has completedAt) → insert into participationHistory
 * 4. Preserves all data during the split
 */
export const splitUserListsTable = internalMutation({
  args: {},
  handler: async (ctx) => {
    console.log("🔄 Starting migration: Split userLists table...\n");

    // Get all userLists entries
    const allEntries = await ctx.db.query("userLists").collect();
    console.log(`📊 Found ${allEntries.length} total userList entries`);

    let activeCount = 0;
    let completedCount = 0;
    let skippedCount = 0;

    for (const entry of allEntries) {
      try {
        // Default sessionNumber to 1 if not set
        const sessionNumber = entry.sessionNumber ?? 1;

        if (!entry.completedAt) {
          // Active user - insert into turnQueue
          await ctx.db.insert("turnQueue", {
            chatId: entry.chatId,
            postId: entry.postId,
            sessionNumber,
            userId: entry.userId,
            position: entry.position,
            channelId: entry.channelId,
            createdAt: entry.createdAt,
            carriedOver: entry.carriedOver,
          });
          activeCount++;
        } else {
          // Completed user - insert into participationHistory
          // Note: sessionType is required in participationHistory, default to empty string if missing
          const sessionType = entry.sessionType || "";

          await ctx.db.insert("participationHistory", {
            chatId: entry.chatId,
            postId: entry.postId,
            sessionNumber,
            userId: entry.userId,
            sessionType,
            notes: entry.notes,
            channelId: entry.channelId,
            createdAt: entry.createdAt,
            completedAt: entry.completedAt,
            originalPosition: entry.position,
            carriedOver: entry.carriedOver,
          });
          completedCount++;
        }
      } catch (error) {
        console.error(`❌ Error migrating entry ${entry._id}:`, error);
        skippedCount++;
      }
    }

    console.log("\n✅ Migration complete!");
    console.log(`   Total entries: ${allEntries.length}`);
    console.log(`   → turnQueue: ${activeCount} active users`);
    console.log(`   → participationHistory: ${completedCount} completed users`);
    console.log(`   ⚠️  Skipped (errors): ${skippedCount}`);

    return {
      total: allEntries.length,
      activeUsers: activeCount,
      completedUsers: completedCount,
      skipped: skippedCount,
    };
  },
});
