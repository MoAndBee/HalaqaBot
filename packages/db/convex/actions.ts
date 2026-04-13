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
 * Creates a bot task to react to a specific message with a heart emoji
 */
export const reactToMessage = action({
  args: {
    chatId: v.number(),
    postId: v.number(),
    messageId: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(api.mutations.createBotTask, {
      type: "react_to_message",
      chatId: args.chatId,
      postId: args.postId,
      messageId: args.messageId,
    });

    return { success: true, taskId: result.taskId };
  },
});

/**
 * One-time backfill: populates the posts table from turnQueue and participationHistory.
 * Only creates post records for posts that have actual participants — informational
 * channel posts (with no users) are excluded.
 *
 * Uses _creationTime (Convex's immutable system field) for reliable timestamps.
 */
export const backfillPosts = action({
  args: {},
  handler: async (ctx) => {
    // Collect unique chatId+postId pairs with earliest timestamp
    const postMap = new Map<string, { chatId: number; postId: number; createdAt: number }>();

    // Helper: paginate through a table and accumulate posts
    async function collectPosts(
      queryFn: (args: { cursor: string | null }) => Promise<{
        page: { chatId: number; postId: number; _creationTime: number }[];
        isDone: boolean;
        continueCursor: string;
      }>
    ) {
      let cursor: string | null = null;
      do {
        const page = await queryFn({ cursor });
        for (const entry of page.page) {
          const key = `${entry.chatId}-${entry.postId}`;
          const timestamp = entry._creationTime;
          const existing = postMap.get(key);
          if (!existing || timestamp < existing.createdAt) {
            postMap.set(key, { chatId: entry.chatId, postId: entry.postId, createdAt: timestamp });
          }
        }
        cursor = page.isDone ? null : page.continueCursor;
      } while (cursor !== null);
    }

    // Scan turnQueue (active participants)
    await collectPosts((args) =>
      ctx.runQuery(internal.queries.getTurnQueueBatch, args)
    );

    // Scan participationHistory (completed participants)
    await collectPosts((args) =>
      ctx.runQuery(internal.queries.getParticipationHistoryBatch, args)
    );

    // Upsert only posts that have real participants
    let totalUpserted = 0;
    for (const post of postMap.values()) {
      await ctx.runMutation(internal.mutations.upsertPostRecord, post);
      totalUpserted++;
    }

    return { totalUpserted };
  },
});
