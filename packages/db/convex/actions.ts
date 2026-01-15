import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

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
