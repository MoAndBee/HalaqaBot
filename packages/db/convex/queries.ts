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
    sessionNumber: v.optional(v.number()), // if not provided, get latest session
  },
  handler: async (ctx, args) => {
    let sessionNumber = args.sessionNumber;

    // If no session number provided, find the latest session
    if (sessionNumber === undefined) {
      const allSessions = await ctx.db
        .query("sessions")
        .withIndex("by_chat_post", (q) =>
          q.eq("chatId", args.chatId).eq("postId", args.postId)
        )
        .collect();

      if (allSessions.length === 0) {
        // No sessions exist, default to session 1
        sessionNumber = 1;
      } else {
        // Sort by createdAt (newest first), with sessionNumber as tiebreaker
        allSessions.sort((a, b) => {
          if (b.createdAt !== a.createdAt) {
            return b.createdAt - a.createdAt;
          }
          return b.sessionNumber - a.sessionNumber;
        });
        sessionNumber = allSessions[0].sessionNumber;
      }
    }

    // Query active users from turnQueue
    const queueEntries = await ctx.db
      .query("turnQueue")
      .withIndex("by_chat_post_session", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId).eq("sessionNumber", sessionNumber)
      )
      .collect();

    // Query completed users from participationHistory
    const completedEntries = await ctx.db
      .query("participationHistory")
      .withIndex("by_chat_post_session", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId).eq("sessionNumber", sessionNumber)
      )
      .collect();

    // Join active users with users table
    const activeUsers = await Promise.all(
      queueEntries.map(async (entry) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_user_id", (q) => q.eq("userId", entry.userId))
          .first();

        return {
          entryId: entry._id,
          id: entry.userId,
          telegramName: user?.telegramName || "",
          realName: user?.realName || null,
          username: user?.username || null,
          position: entry.position,
          createdAt: entry.createdAt,
          carriedOver: entry.carriedOver,
          sessionType: entry.sessionType,
          notes: null,
          isCompensation: entry.isCompensation,
          compensatingForDates: entry.compensatingForDates,
        };
      })
    );

    // Sort active users by position
    activeUsers.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.createdAt - b.createdAt;
    });

    // Join completed users with users table
    const completedUsers = await Promise.all(
      completedEntries.map(async (entry) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_user_id", (q) => q.eq("userId", entry.userId))
          .first();

        return {
          entryId: entry._id,
          id: entry.userId,
          telegramName: user?.telegramName || "",
          realName: user?.realName || null,
          username: user?.username || null,
          position: entry.originalPosition,
          createdAt: entry.createdAt,
          completedAt: entry.completedAt,
          sessionType: entry.sessionType,
          notes: entry.notes || null,
          isCompensation: entry.isCompensation,
          compensatingForDates: entry.compensatingForDates,
        };
      })
    );

    // Sort completed users by completion time
    completedUsers.sort((a, b) => {
      if (a.completedAt !== b.completedAt) return a.completedAt - b.completedAt;
      return a.createdAt - b.createdAt;
    });

    return {
      activeUsers,
      completedUsers,
      currentSession: sessionNumber,
    };
  },
});

export const getAvailableSessions = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
  },
  handler: async (ctx, args) => {
    // Query sessions table directly to get all sessions
    const allSessions = await ctx.db
      .query("sessions")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    // Sort by createdAt (newest first), with sessionNumber as tiebreaker
    const sortedSessions = allSessions.sort((a, b) => {
      if (b.createdAt !== a.createdAt) {
        return b.createdAt - a.createdAt;
      }
      return b.sessionNumber - a.sessionNumber;
    });

    return sortedSessions.map(session => ({
      sessionNumber: session.sessionNumber,
      teacherName: session.teacherName,
      createdAt: session.createdAt,
    }));
  },
});

export const getSessionInfo = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
    sessionNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const sessionMeta = await ctx.db
      .query("sessions")
      .withIndex("by_chat_post_session", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId).eq("sessionNumber", args.sessionNumber)
      )
      .first();

    if (!sessionMeta) return null;

    return {
      sessionNumber: sessionMeta.sessionNumber,
      teacherName: sessionMeta.teacherName,
      createdAt: sessionMeta.createdAt,
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

    if (!record) return null;

    return {
      messageId: record.messageId,
      chatId: record.chatId,
      postId: record.postId,
      channelId: record.channelId,
      updatedAt: record.updatedAt,
    };
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
      activityType: classification.activityType,
    };
  },
});

export const getLatestActivityTypeForUser = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
    userId: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all messageAuthors entries for this user in this post
    const userMessages = await ctx.db
      .query("messageAuthors")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();

    if (userMessages.length === 0) {
      return null;
    }

    // Get all classifications for these messages that have an activityType
    const allClassifications = [];
    for (const msg of userMessages) {
      const classification = await ctx.db
        .query("messageClassifications")
        .withIndex("by_chat_post_message", (q) =>
          q.eq("chatId", args.chatId)
           .eq("postId", args.postId)
           .eq("messageId", msg.messageId)
        )
        .first();

      if (classification?.activityType) {
        allClassifications.push(classification);
      }
    }

    if (allClassifications.length === 0) {
      return null;
    }

    // Sort by classifiedAt (most recent first)
    allClassifications.sort((a, b) => b.classifiedAt - a.classifiedAt);

    return allClassifications[0].activityType;
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
    // Get all users in the list (from both turnQueue and participationHistory)
    const queueUsers = await ctx.db
      .query("turnQueue")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    const completedUsers = await ctx.db
      .query("participationHistory")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    const excludedUserIds = new Set([
      ...queueUsers.map((u) => u.userId),
      ...completedUsers.map((u) => u.userId),
    ]);

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
    // Get users from both turnQueue and participationHistory
    const queueUsers = await ctx.db.query("turnQueue").collect();
    const completedUsers = await ctx.db.query("participationHistory").collect();
    const allUsers = [...queueUsers, ...completedUsers];

    const allMessages = await ctx.db.query("messageAuthors").collect();

    // Create a map of post keys to earliest message timestamp
    const postDatesMap = new Map<string, number>();
    for (const msg of allMessages) {
      const key = `${msg.chatId}-${msg.postId}`;
      const existingDate = postDatesMap.get(key);
      if (!existingDate || msg.createdAt < existingDate) {
        postDatesMap.set(key, msg.createdAt);
      }
    }

    const postsMap = new Map<
      string,
      { chatId: number; postId: number; userCount: number; createdAt: number }
    >();

    for (const user of allUsers) {
      const key = `${user.chatId}-${user.postId}`;
      if (!postsMap.has(key)) {
        postsMap.set(key, {
          chatId: user.chatId,
          postId: user.postId,
          userCount: 0,
          createdAt: postDatesMap.get(key) ?? Date.now(),
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
    // Get users from both turnQueue and participationHistory
    const queueUsers = await ctx.db
      .query("turnQueue")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    const completedUsers = await ctx.db
      .query("participationHistory")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    const messages = await ctx.db
      .query("messageAuthors")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    // Get the earliest message for creation date
    const firstMessage = await ctx.db
      .query("messageAuthors")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .first();

    return {
      userCount: queueUsers.length + completedUsers.length,
      messageCount: messages.length,
      createdAt: firstMessage?.createdAt ?? Date.now(),
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

export const searchUsers = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.query.trim()) {
      return [];
    }

    const users = await ctx.db.query("users").collect();
    const lowerQuery = args.query.toLowerCase();

    return users
      .filter((user) => {
        const realName = user.realName?.toLowerCase() || "";
        const telegramName = user.telegramName.toLowerCase();
        const username = user.username?.toLowerCase() || "";

        return (
          realName.includes(lowerQuery) ||
          telegramName.includes(lowerQuery) ||
          username.includes(lowerQuery)
        );
      })
      .slice(0, 20) // Limit results
      .map((user) => ({
        userId: user.userId,
        username: user.username,
        telegramName: user.telegramName,
        realName: user.realName,
      }));
  },
});

export const getUsersByIds = query({
  args: {
    userIds: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const users = await Promise.all(
      args.userIds.map(async (userId) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_user_id", (q) => q.eq("userId", userId))
          .first();
        return user;
      })
    );

    return users
      .filter((user) => user !== null)
      .map((user) => ({
        userId: user!.userId,
        username: user!.username,
        telegramName: user!.telegramName,
        realName: user!.realName,
      }));
  },
});

export const getPendingBotTasks = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db
      .query("botTasks")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return tasks.map((task) => ({
      _id: task._id,
      type: task.type,
      chatId: task.chatId,
      postId: task.postId,
      sessionNumber: task.sessionNumber,
      status: task.status,
      createdAt: task.createdAt,
    }));
  },
});

export const getParticipationSummary = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all sessions for this post
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    const sessionsCount = sessions.length;

    // Get all users from both tables
    const queueUsers = await ctx.db
      .query("turnQueue")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    const completedEntries = await ctx.db
      .query("participationHistory")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    // Calculate unique attendance (unique user IDs from both tables)
    const allUserIds = new Set([
      ...queueUsers.map((entry) => entry.userId),
      ...completedEntries.map((entry) => entry.userId),
    ]);
    const totalAttendance = allUserIds.size;

    // Completed participations
    const totalParticipations = completedEntries.length;

    // Calculate participation rate
    const participationRate = totalAttendance > 0
      ? Math.round((totalParticipations / totalAttendance) * 100)
      : 0;

    // Get total users count from users table
    const allUsers = await ctx.db.query("users").collect();
    const totalUsersCount = allUsers.length;

    // Group by session type
    const byType: Record<string, { label: string; count: number; nonParticipantCount: number }> = {};

    const sessionTypes = [
      { key: 'tilawa', label: 'تلاوة' },
      { key: 'tasmee', label: 'تسميع' },
      { key: 'tatbeeq', label: 'تطبيق' },
      { key: 'ikhtebar', label: 'اختبار' },
    ];

    for (const type of sessionTypes) {
      const typeEntries = completedEntries.filter(
        (entry) => entry.sessionType?.includes(type.label) || entry.sessionType === type.label
      );

      // Calculate non-participants for this specific session type
      // Get unique users who participated in this type
      const typeUserIds = new Set(typeEntries.map((entry) => entry.userId));

      if (typeEntries.length > 0) {
        byType[type.key] = {
          label: type.label,
          count: typeEntries.length,
          nonParticipantCount: totalUsersCount - typeUserIds.size,
        };
      }
    }

    return {
      sessionsCount,
      totalAttendance,
      totalParticipations,
      participationRate,
      byType,
    };
  },
});
