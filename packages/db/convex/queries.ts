import { query } from "./_generated/server";
import { v } from "convex/values";

export const getMessageAuthor = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
    messageId: v.number(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query("messageAuthors")
      .withIndex("by_chat_post_message", (q) =>
        q
          .eq("chatId", args.chatId)
          .eq("postId", args.postId)
          .eq("messageId", args.messageId)
      )
      .first();

    if (!message) return null;

    return {
      id: message.userId,
      first_name: message.firstName,
      last_name: message.lastName,
      username: message.username,
    };
  },
});

export const getPostIdForMessage = query({
  args: {
    chatId: v.number(),
    messageId: v.number(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query("messageAuthors")
      .filter((q) =>
        q.and(
          q.eq(q.field("chatId"), args.chatId),
          q.eq(q.field("messageId"), args.messageId)
        )
      )
      .first();

    if (!message) return null;

    return {
      postId: message.postId,
      channelId: message.channelId ?? null,
    };
  },
});

export const getUserList = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
  },
  handler: async (ctx, args) => {
    const userListEntries = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    // Sort by carriedOver first (true before false), then by position
    userListEntries.sort((a, b) => {
      // Carried over users come first
      if (a.carriedOver && !b.carriedOver) return -1;
      if (!a.carriedOver && b.carriedOver) return 1;
      // Then sort by position
      return a.position - b.position;
    });

    // Join with users table to get name information
    const usersWithData = await Promise.all(
      userListEntries.map(async (entry) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_user_id", (q) => q.eq("userId", entry.userId))
          .first();

        return {
          entry,
          userData: user || null,
        };
      })
    );

    // Separate active and completed users
    const activeUsers = usersWithData
      .filter(({ entry }) => !entry.completedAt)
      .map(({ entry, userData }) => ({
        id: entry.userId,
        telegramName: userData?.telegramName || "",
        realName: userData?.realName || null,
        username: userData?.username || null,
        position: entry.position,
        carriedOver: entry.carriedOver,
        sessionType: entry.sessionType,
      }));

    const completedUsers = usersWithData
      .filter(({ entry }) => entry.completedAt)
      .map(({ entry, userData }) => ({
        id: entry.userId,
        telegramName: userData?.telegramName || "",
        realName: userData?.realName || null,
        username: userData?.username || null,
        position: entry.position,
        completedAt: entry.completedAt,
        sessionType: entry.sessionType,
      }));

    return {
      activeUsers,
      completedUsers,
    };
  },
});

export const getLastListMessage = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("lastListMessages")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .first();

    return record?.messageId ?? null;
  },
});

export const getClassification = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
    messageId: v.number(),
  },
  handler: async (ctx, args) => {
    const classification = await ctx.db
      .query("messageClassifications")
      .withIndex("by_chat_post_message", (q) =>
        q
          .eq("chatId", args.chatId)
          .eq("postId", args.postId)
          .eq("messageId", args.messageId)
      )
      .first();

    if (!classification) return null;

    return {
      containsName: classification.containsName,
      detectedNames: classification.detectedNames,
    };
  },
});

export const getMessageText = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
    messageId: v.number(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query("messageAuthors")
      .withIndex("by_chat_post_message", (q) =>
        q
          .eq("chatId", args.chatId)
          .eq("postId", args.postId)
          .eq("messageId", args.messageId)
      )
      .first();

    return message?.messageText ?? null;
  },
});

export const getUnclassifiedMessages = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all users in the list
    const userListUsers = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    const excludedUserIds = new Set(userListUsers.map((u) => u.userId));

    // Get all classified messages
    const classifications = await ctx.db
      .query("messageClassifications")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    const excludedMessageIds = new Set(
      classifications.map((c) => c.messageId)
    );

    // Get all messages for this post
    const messages = await ctx.db
      .query("messageAuthors")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    // Filter out users already in list and already classified messages
    const uniqueMessages = new Map();
    for (const msg of messages) {
      if (
        !excludedUserIds.has(msg.userId) &&
        !excludedMessageIds.has(msg.messageId) &&
        !uniqueMessages.has(msg.messageId)
      ) {
        uniqueMessages.set(msg.messageId, {
          messageId: msg.messageId,
          text: msg.messageText || "",
          user: {
            id: msg.userId,
            first_name: msg.firstName,
            last_name: msg.lastName,
            username: msg.username,
          },
        });
      }
    }

    return Array.from(uniqueMessages.values()).sort(
      (a, b) => a.messageId - b.messageId
    );
  },
});

export const getAllPosts = query({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("userLists").collect();

    const postsMap = new Map<
      string,
      { chatId: number; postId: number; userCount: number }
    >();

    for (const user of allUsers) {
      const key = `${user.chatId}-${user.postId}`;
      if (!postsMap.has(key)) {
        postsMap.set(key, {
          chatId: user.chatId,
          postId: user.postId,
          userCount: 0,
        });
      }
      postsMap.get(key)!.userCount++;
    }

    return Array.from(postsMap.values()).sort((a, b) => {
      if (a.chatId !== b.chatId) return a.chatId - b.chatId;
      return b.postId - a.postId;
    });
  },
});

export const getPostDetails = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    if (users.length === 0) return null;

    const messages = await ctx.db
      .query("messageAuthors")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    return {
      userCount: users.length,
      messageCount: messages.length,
    };
  },
});

export const getChannelIdForPost = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
  },
  handler: async (ctx, args) => {
    // Try to get channel ID from messageAuthors first
    const message = await ctx.db
      .query("messageAuthors")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .first();

    return message?.channelId ?? null;
  },
});

export const getAllMessageClassifications = query({
  args: {},
  handler: async (ctx) => {
    const classifications = await ctx.db
      .query("messageClassifications")
      .collect();

    return classifications.map((classification) => ({
      chatId: classification.chatId,
      postId: classification.postId,
      messageId: classification.messageId,
      containsName: classification.containsName,
      detectedNames: classification.detectedNames,
      messageText: classification.messageText ?? null,
    }));
  },
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();

    return users.map((user) => ({
      userId: user.userId,
      username: user.username,
      telegramName: user.telegramName,
      realName: user.realName,
      sourceMessageText: user.sourceMessageText,
      updatedAt: user.updatedAt,
    }));
  },
});

export const getUser = query({
  args: {
    userId: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) return null;

    return {
      userId: user.userId,
      username: user.username,
      telegramName: user.telegramName,
      realName: user.realName,
      realNameVerified: user.realNameVerified,
      sourceMessageText: user.sourceMessageText,
      updatedAt: user.updatedAt,
    };
  },
});

export const getMessagesByUserId = query({
  args: {
    userId: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messageAuthors")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();

    return messages.map((msg) => ({
      chatId: msg.chatId,
      postId: msg.postId,
      messageId: msg.messageId,
      messageText: msg.messageText,
      createdAt: msg.createdAt,
    }));
  },
});
