import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

/**
 * Creates a bot task to send the participant list as a message to the post
 */
export const sendParticipantList = action({
  args: {
    chatId: v.number(),
    postId: v.number(),
    sessionNumber: v.optional(v.number()),
    flower: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Query the user list first to ensure the cache is warmed up with fresh data
    // This prevents the bot from hitting stale cached data when it processes the task
    await ctx.runQuery(api.queries.getUserList, {
      chatId: args.chatId,
      postId: args.postId,
      sessionNumber: args.sessionNumber,
    });

    // Create a task for the bot to process
    const result = await ctx.runMutation(api.mutations.createBotTask, {
      type: "send_participant_list",
      chatId: args.chatId,
      postId: args.postId,
      sessionNumber: args.sessionNumber,
      flower: args.flower,
    });

    return { success: true, taskId: result.taskId };
  },
});

type BatchPage = {
  page: { chatId: number; postId: number; createdAt: number }[];
  isDone: boolean;
  continueCursor: string;
};

/**
 * Paginates through a table using the given internal query and upserts all
 * unique chatId+postId pairs into the posts table.
 */
async function backfillFromTable(
  ctx: { runQuery: (fn: any, args: any) => Promise<any>; runMutation: (fn: any, args: any) => Promise<any> },
  queryFn: any,
  tableName: string
): Promise<number> {
  let cursor: string | null = null;
  let count = 0;

  do {
    const page: BatchPage = await ctx.runQuery(queryFn, { cursor });

    const postMap = new Map<string, { chatId: number; postId: number; createdAt: number }>();
    for (const row of page.page) {
      const key = `${row.chatId}-${row.postId}`;
      const existing = postMap.get(key);
      if (!existing || row.createdAt < existing.createdAt) {
        postMap.set(key, { chatId: row.chatId, postId: row.postId, createdAt: row.createdAt });
      }
    }

    for (const post of postMap.values()) {
      await ctx.runMutation(internal.mutations.upsertPostRecord, post);
      count++;
    }

    cursor = page.isDone ? null : page.continueCursor;
  } while (cursor !== null);

  console.log(`backfillPosts: upserted ${count} records from ${tableName}`);
  return count;
}

/**
 * One-time backfill: populates the posts table from all four source tables
 * (messageAuthors, userLists, turnQueue, participationHistory).
 * Run this once from the Convex dashboard after deploying the schema change.
 * Safe to re-run — uses upsert logic so no duplicates will be created.
 */
export const backfillPosts = action({
  args: {},
  handler: async (ctx) => {
    const counts = await Promise.all([
      backfillFromTable(ctx, internal.queries.getMessageAuthorsBatch, "messageAuthors"),
      backfillFromTable(ctx, internal.queries.getUserListsBatch, "userLists"),
      backfillFromTable(ctx, internal.queries.getTurnQueueBatch, "turnQueue"),
      backfillFromTable(ctx, internal.queries.getParticipationHistoryBatch, "participationHistory"),
    ]);

    return {
      messageAuthors: counts[0],
      userLists: counts[1],
      turnQueue: counts[2],
      participationHistory: counts[3],
      totalUpserted: counts.reduce((a, b) => a + b, 0),
    };
  },
});

/**
 * One-time cleanup: removes duplicate entries from the posts table, keeping
 * only the record with the earliest createdAt for each chatId+postId pair.
 * Run this from the Convex dashboard if duplicates were created by a prior
 * bad backfill run.
 */
export const cleanupDuplicatePosts = action({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    const seen = new Map<string, { id: string; createdAt: number }>();
    const toDelete: string[] = [];

    do {
      const page: { page: { _id: string; chatId: number; postId: number; createdAt: number }[]; isDone: boolean; continueCursor: string } =
        await ctx.runQuery(internal.queries.getPostsBatch, { cursor });

      for (const post of page.page) {
        const key = `${post.chatId}-${post.postId}`;
        const existing = seen.get(key);
        if (!existing) {
          seen.set(key, { id: post._id, createdAt: post.createdAt });
        } else if (post.createdAt < existing.createdAt) {
          // This record is earlier — keep it, schedule old one for deletion
          toDelete.push(existing.id);
          seen.set(key, { id: post._id, createdAt: post.createdAt });
        } else {
          // This record is a later duplicate — schedule it for deletion
          toDelete.push(post._id);
        }
      }

      cursor = page.isDone ? null : page.continueCursor;
    } while (cursor !== null);

    for (const id of toDelete) {
      await ctx.runMutation(internal.mutations.deletePostRecord, { id: id as any });
    }

    console.log(`cleanupDuplicatePosts: deleted ${toDelete.length} duplicate records`);
    return { deleted: toDelete.length };
  },
});
