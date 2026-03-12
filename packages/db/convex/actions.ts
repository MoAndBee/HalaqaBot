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

/**
 * One-time backfill: populates the posts table from existing messageAuthors data.
 * Run this once from the Convex dashboard after deploying the schema change.
 */
export const backfillPosts = action({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let totalUpserted = 0;

    do {
      const page: { page: { chatId: number; postId: number; createdAt: number }[]; isDone: boolean; continueCursor: string } =
        await ctx.runQuery(internal.queries.getMessageAuthorsBatch, { cursor });

      // Deduplicate within this batch, keeping the earliest timestamp per post
      const postMap = new Map<string, { chatId: number; postId: number; createdAt: number }>();
      for (const msg of page.page) {
        const key = `${msg.chatId}-${msg.postId}`;
        const existing = postMap.get(key);
        if (!existing || msg.createdAt < existing.createdAt) {
          postMap.set(key, { chatId: msg.chatId, postId: msg.postId, createdAt: msg.createdAt });
        }
      }

      for (const post of postMap.values()) {
        await ctx.runMutation(internal.mutations.upsertPostRecord, post);
        totalUpserted++;
      }

      cursor = page.isDone ? null : page.continueCursor;
    } while (cursor !== null);

    return { totalUpserted };
  },
});
