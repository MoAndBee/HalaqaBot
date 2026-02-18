import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Queue a bot task to mute a participant in the group chat
 */
export const muteParticipant = action({
  args: {
    chatId: v.number(),
    postId: v.number(),
    userId: v.number(),
    mutedBy: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(api.mutations.muteParticipant, {
      chatId: args.chatId,
      postId: args.postId,
      userId: args.userId,
      mutedBy: args.mutedBy,
    });
    return { success: true, taskId: result.taskId };
  },
});

/**
 * Queue a bot task to unmute a participant in the group chat
 */
export const unmuteParticipant = action({
  args: {
    chatId: v.number(),
    postId: v.number(),
    userId: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(api.mutations.unmuteParticipant, {
      chatId: args.chatId,
      postId: args.postId,
      userId: args.userId,
    });
    return { success: true, taskId: result.taskId };
  },
});

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
