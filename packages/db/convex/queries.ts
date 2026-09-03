import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator, type GenericDatabaseReader } from "convex/server";
import type { DataModel, Doc } from "./_generated/dataModel";

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
      .withIndex("by_chat_message", (q) =>
        q.eq("chatId", args.chatId).eq("messageId", args.messageId)
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
          notes: entry.notes || null,
          score: entry.score ?? null,
          isCompensation: entry.isCompensation,
          compensatingForDates: entry.compensatingForDates,
          wasSkipped: entry.wasSkipped,
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
          score: entry.score ?? null,
          isCompensation: entry.isCompensation,
          compensatingForDates: entry.compensatingForDates,
          recordCreatedAt: entry._creationTime, // When the participation record was created
        };
      })
    );

    // Sort completed users by when they were marked complete (document creation time)
    // This ensures newly completed users appear at the end of the list
    completedUsers.sort((a, b) => {
      return a.recordCreatedAt - b.recordCreatedAt;
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
      supervisorName: session.supervisorName,
      createdAt: session.createdAt,
      registrationClosed: session.registrationClosed,
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
      supervisorName: sessionMeta.supervisorName,
      createdAt: sessionMeta.createdAt,
      isLocked: sessionMeta.isLocked,
      lockedAt: sessionMeta.lockedAt,
      lockedBy: sessionMeta.lockedBy,
      registrationClosed: sessionMeta.registrationClosed,
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
      sessionNumber: record.sessionNumber,
      channelId: record.channelId,
      registrationClosedImageMessageId: record.registrationClosedImageMessageId,
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

export const getPaginatedPosts = query({
  args: { paginationOpts: paginationOptsValidator, chatId: v.number() },
  handler: async (ctx, args) => {
    // Scope posts to the selected channel's discussion group so each channel's
    // admins only see their own posts.
    const result = await ctx.db
      .query("posts")
      .withIndex("by_chat_created", (q) => q.eq("chatId", args.chatId))
      .order("desc")
      .paginate(args.paginationOpts);

    const enriched = await Promise.all(
      result.page.map(async (post) => {
        const queueUsers = await ctx.db
          .query("turnQueue")
          .withIndex("by_chat_post", (q) =>
            q.eq("chatId", post.chatId).eq("postId", post.postId)
          )
          .collect();
        const completedUsers = await ctx.db
          .query("participationHistory")
          .withIndex("by_chat_post", (q) =>
            q.eq("chatId", post.chatId).eq("postId", post.postId)
          )
          .collect();
        const uniqueUsers = new Set(
          [...queueUsers, ...completedUsers].map((u) => u.userId)
        );
        return {
          chatId: post.chatId,
          postId: post.postId,
          createdAt: post.createdAt,
          userCount: uniqueUsers.size,
        };
      })
    );

    return { ...result, page: enriched };
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
      { chatId: number; postId: number; userCount: number; createdAt: number; userIds: Set<number> }
    >();

    for (const user of allUsers) {
      const key = `${user.chatId}-${user.postId}`;
      if (!postsMap.has(key)) {
        postsMap.set(key, {
          chatId: user.chatId,
          postId: user.postId,
          userCount: 0,
          createdAt: postDatesMap.get(key) ?? Date.now(),
          userIds: new Set(),
        });
      }
      // Add user ID to set (automatically handles duplicates)
      postsMap.get(key)!.userIds.add(user.userId);
    }

    // Update userCount based on unique user IDs
    for (const post of postsMap.values()) {
      post.userCount = post.userIds.size;
    }

    // Return posts without the userIds Set (not serializable)
    return Array.from(postsMap.values())
      .map(({ chatId, postId, userCount, createdAt }) => ({
        chatId,
        postId,
        userCount,
        createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
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

    // Count unique users (avoid counting duplicates for users with multiple participation types)
    const uniqueUserIds = new Set([
      ...queueUsers.map((u) => u.userId),
      ...completedUsers.map((u) => u.userId),
    ]);

    return {
      userCount: uniqueUserIds.size,
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
      realNameVerified: user.realNameVerified,
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

export const getUserParticipations = query({
  args: {
    userId: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all participations for this user
    const participations = await ctx.db
      .query("participationHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Sort by completedAt (newest first)
    participations.sort((a, b) => b.completedAt - a.completedAt);

    return participations.map((p) => ({
      completedAt: p.completedAt,
      sessionType: p.sessionType,
      chatId: p.chatId,
      postId: p.postId,
      sessionNumber: p.sessionNumber,
      notes: p.notes,
      score: p.score ?? null,
      compensatingForDates: p.compensatingForDates,
    }));
  },
});

export const getMessagesForPost = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messageAuthors")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .order("asc")
      .collect();

    // Load every classification for the post in one index scan rather than a
    // point read per message.
    const classifications = await ctx.db
      .query("messageClassifications")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    const classificationByMessageId = new Map(
      classifications.map((c) => [c.messageId, c])
    );

    // Users repeat heavily across a post's messages, so read each one once.
    const userIds = [...new Set(messages.map((m) => m.userId))];
    const userDocs = await Promise.all(
      userIds.map((userId) =>
        ctx.db
          .query("users")
          .withIndex("by_user_id", (q) => q.eq("userId", userId))
          .unique()
      )
    );
    const userByUserId = new Map(userIds.map((userId, i) => [userId, userDocs[i]]));

    return messages.map((msg) => {
      const classification = classificationByMessageId.get(msg.messageId);
      const user = userByUserId.get(msg.userId);

      return {
        messageId: msg.messageId,
        userId: msg.userId,
        firstName: msg.firstName,
        lastName: msg.lastName,
        username: msg.username,
        messageText: msg.messageText,
        createdAt: msg.createdAt,
        isPost: msg.messageId === args.postId,
        classification: classification
          ? {
              activityType: classification.activityType,
              containsName: classification.containsName,
            }
          : null,
        user: user
          ? {
              realName: user.realName,
              realNameVerified: user.realNameVerified,
            }
          : null,
      };
    });
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

/**
 * Every user who belongs to a channel's discussion group, so one channel's
 * admins don't see another channel's roster.
 *
 * Membership is mostly inferred from turns taken, but that alone makes a
 * manually registered user invisible: she is created with no participation at
 * all, so she could never be found to be added to a halaqa in the first place.
 * Her `homeChatId` covers that gap.
 */
export async function collectChatUserIds(
  ctx: { db: GenericDatabaseReader<DataModel> },
  chatId: number
): Promise<Set<number>> {
  const queueUsers = await ctx.db
    .query("turnQueue")
    .filter((q) => q.eq(q.field("chatId"), chatId))
    .collect();
  const historyUsers = await ctx.db
    .query("participationHistory")
    .filter((q) => q.eq(q.field("chatId"), chatId))
    .collect();
  const registered = await ctx.db
    .query("users")
    .withIndex("by_home_chat", (q) => q.eq("homeChatId", chatId))
    .collect();

  return new Set([
    ...queueUsers.map((u) => u.userId),
    ...historyUsers.map((u) => u.userId),
    ...registered.map((u) => u.userId),
  ]);
}

/**
 * Users registered by hand before `homeChatId` existed have no channel on
 * record and no turns to infer one from, so scoping them to any single channel
 * is impossible — they are shown everywhere rather than nowhere. Manual
 * registration mints negative ids, which is what identifies them. Drop this
 * once such rows have been given a `homeChatId`.
 */
function isUnaffiliatedLegacyUser(user: Doc<"users">): boolean {
  return user.userId < 0 && user.homeChatId === undefined;
}

/**
 * Fold the Arabic spelling variants that make a literal search miss: hamza
 * forms (أإآ → ا), ة → ه, ى → ي, ؤ/ئ, tatweel and tashkeel, plus case for
 * Latin usernames. Names reach the database however whoever typed them spelled
 * them — hand-registered ones especially — so searching "فاطمه" has to find
 * "فاطمة". Mirrors normalizeArabic in the web app's StudentPickerModal.
 */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

export const searchUsers = query({
  args: {
    query: v.string(),
    // When provided, restrict results to users who belong to this channel's
    // discussion group, so one channel's admins don't see another channel's
    // roster.
    chatId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.query.trim()) {
      return [];
    }

    // A query of nothing but tashkeel normalizes to "", which every name
    // "contains" — that would return an arbitrary 20 users rather than none.
    const normalizedQuery = normalizeName(args.query);
    if (normalizedQuery === "") {
      return [];
    }

    const users = await ctx.db.query("users").collect();

    // Build the set of userIds that belong to the requested channel's chat.
    let allowedUserIds: Set<number> | null = null;
    if (args.chatId !== undefined) {
      allowedUserIds = await collectChatUserIds(ctx, args.chatId);
    }

    return users
      .filter(
        (user) =>
          allowedUserIds === null ||
          allowedUserIds.has(user.userId) ||
          isUnaffiliatedLegacyUser(user)
      )
      .filter((user) => {
        const realName = normalizeName(user.realName ?? "");
        const telegramName = normalizeName(user.telegramName);
        const username = normalizeName(user.username ?? "");

        return (
          realName.includes(normalizedQuery) ||
          telegramName.includes(normalizedQuery) ||
          username.includes(normalizedQuery)
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
      messageId: task.messageId,
      sessionNumber: task.sessionNumber,
      flower: task.flower,
      importId: task.importId,
      status: task.status,
      createdAt: task.createdAt,
    }));
  },
});

/**
 * Status of a single bot task, for the web app to track a queued task (e.g.
 * a participant list send) through to actual completion by the bot.
 */
export const getBotTaskStatus = query({
  args: {
    taskId: v.id("botTasks"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    return {
      status: task.status,
      error: task.error,
    };
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

/**
 * Data for the per-day attendance record (سجل الحضور) of تسميع participations.
 * Returns the channel's roster (everyone who ever joined a queue or completed a
 * participation in this chat) plus every participation that counts toward
 * تسميع attendance: entries whose sessionType is تسميع, and compensation
 * entries (compensatingForDates) which count toward the days they compensate.
 * Grouping by day happens on the client so days follow the viewer's timezone,
 * matching the per-student calendar.
 */
export const getTasmeeAttendance = query({
  args: {
    chatId: v.number(),
  },
  handler: async (ctx, args) => {
    const chatId = args.chatId;

    const [historyEntries, queueEntries] = await Promise.all([
      ctx.db
        .query("participationHistory")
        .filter((q) => q.eq(q.field("chatId"), chatId))
        .collect(),
      ctx.db
        .query("turnQueue")
        .filter((q) => q.eq(q.field("chatId"), chatId))
        .collect(),
    ]);

    // Roster: everyone who has ever appeared in this chat's queue or history.
    const rosterIds = new Set([
      ...historyEntries.map((e) => e.userId),
      ...queueEntries.map((e) => e.userId),
    ]);

    const users = await Promise.all(
      [...rosterIds].map((userId) =>
        ctx.db
          .query("users")
          .withIndex("by_user_id", (q) => q.eq("userId", userId))
          .first()
      )
    );

    const roster = [...rosterIds].map((userId, i) => {
      const user = users[i];
      return {
        userId,
        telegramName: user?.telegramName ?? null,
        realName: user?.realName ?? null,
        username: user?.username ?? null,
      };
    });

    const participations = historyEntries
      .filter(
        (e) =>
          e.sessionType.includes("تسميع") ||
          (e.compensatingForDates && e.compensatingForDates.length > 0)
      )
      .map((e) => ({
        userId: e.userId,
        completedAt: e.completedAt,
        sessionType: e.sessionType,
        compensatingForDates: e.compensatingForDates ?? null,
        postId: e.postId,
      }));

    return { roster, participations };
  },
});

export const getExamRecords = query({
  args: {
    chatId: v.number(),
  },
  handler: async (ctx, args) => {
    // All completed اختبار participations for this chat
    const examEntries = await ctx.db
      .query("participationHistory")
      .filter((q) =>
        q.and(
          q.eq(q.field("chatId"), args.chatId),
          q.eq(q.field("sessionType"), "اختبار")
        )
      )
      .collect();

    const userIds = [...new Set(examEntries.map((e) => e.userId))];

    const users = await Promise.all(
      userIds.map((userId) =>
        ctx.db
          .query("users")
          .withIndex("by_user_id", (q) => q.eq("userId", userId))
          .first()
      )
    );

    const usersById = new Map(userIds.map((userId, i) => [userId, users[i]]));

    return examEntries.map((e) => {
      const user = usersById.get(e.userId);
      return {
        entryId: e._id,
        userId: e.userId,
        name:
          user?.realName ||
          user?.telegramName ||
          (user?.username ? `@${user.username}` : `#${e.userId}`),
        completedAt: e.completedAt,
        score: e.score ?? null,
        postId: e.postId,
        // Session context, so the bulk score flow can file a new اختبار
        // participation against the same halaqa an exam day belongs to.
        sessionNumber: e.sessionNumber,
        channelId: e.channelId ?? null,
      };
    });
  },
});

/**
 * Every student known to this channel — anyone who has ever taken a turn in it,
 * whether completed or still queued. The bulk score paste flow matches pasted
 * names against this beyond the exam day's own roster, so a student the teacher
 * scored on paper but who never registered a turn in the exam halaqa can still
 * be given a record.
 */
export const getChannelStudents = query({
  args: {
    chatId: v.number(),
  },
  handler: async (ctx, args) => {
    const allUsers = await ctx.db.query("users").collect();
    const chatUserIds = await collectChatUserIds(ctx, args.chatId);

    // A hand-registered student is exactly the kind of person this list exists
    // for — scored on paper, never having taken a turn — so the legacy
    // allowance applies here too.
    const userIds = [
      ...new Set([
        ...chatUserIds,
        ...allUsers.filter(isUnaffiliatedLegacyUser).map((u) => u.userId),
      ]),
    ];

    const usersById = new Map(allUsers.map((u) => [u.userId, u]));

    return userIds.map((userId) => {
      const user = usersById.get(userId);
      return {
        userId,
        name:
          user?.realName ||
          user?.telegramName ||
          (user?.username ? `@${user.username}` : `#${userId}`),
      };
    });
  },
});

export const getLongMessagesBySaturday = query({
  args: {
    adminUserIds: v.array(v.number()), // Admin user IDs to filter by
  },
  handler: async (ctx, args) => {
    const adminUserIds = new Set(args.adminUserIds);

    // Saturday 20/12/2025 timestamps (UTC)
    // Start: December 20, 2025 at 00:00:00 UTC
    // End: December 20, 2025 at 23:59:59.999 UTC
    const startDate = new Date('2025-12-20T00:00:00.000Z').getTime();
    const endDate = new Date('2025-12-20T23:59:59.999Z').getTime();

    // Get all messages from the messageAuthors table
    const allMessages = await ctx.db.query("messageAuthors").collect();

    // Filter messages by date and admin status
    const adminMessages = allMessages.filter((msg) => {
      const isInDateRange = msg.createdAt >= startDate && msg.createdAt <= endDate;
      const isAdmin = adminUserIds.has(msg.userId);
      return isInDateRange && isAdmin;
    });

    // Sort by time (earliest first)
    adminMessages.sort((a, b) => a.createdAt - b.createdAt);

    return adminMessages.map((msg) => ({
      chatId: msg.chatId,
      postId: msg.postId,
      messageId: msg.messageId,
      userId: msg.userId,
      firstName: msg.firstName,
      lastName: msg.lastName,
      username: msg.username,
      messageText: msg.messageText,
      messageLength: msg.messageText?.length ?? 0,
      createdAt: msg.createdAt,
      channelId: msg.channelId,
    }));
  },
});

/**
 * List the channels a given user administers. Powers the web-app channel picker:
 * joins channelAdmins (by user) against the channels registry. Only active,
 * registered channels are returned. When the user administers exactly one
 * channel the client auto-selects it and skips the picker.
 */
export const getMyChannels = query({
  args: {
    userId: v.number(),
  },
  handler: async (ctx, args) => {
    // Find every channel this user is an admin of.
    const adminRows = await ctx.db.query("channelAdmins").collect();
    const myChannelIds = new Set(
      adminRows
        .filter((row) => row.userId === args.userId)
        .map((row) => row.channelId)
    );

    if (myChannelIds.size === 0) return [];

    const channels = await ctx.db
      .query("channels")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    const mine = channels.filter((c) => myChannelIds.has(c.channelId));

    // A discussion group can end up registered as a "channel" of its own
    // (channelId === chatId). When a real channel row points at the same chat,
    // hide the group row so the picker doesn't show duplicates and supervisor
    // lookups stay keyed to the real channel.
    const realChannelChatIds = new Set(
      channels.filter((c) => c.channelId !== c.chatId).map((c) => c.chatId)
    );

    return mine
      .filter(
        (c) => c.channelId !== c.chatId || !realChannelChatIds.has(c.chatId)
      )
      .map((c) => ({
        channelId: c.channelId,
        chatId: c.chatId,
        title: c.title,
      }));
  },
});

/**
 * Return all active channels in the registry. Used by the bot to iterate
 * channels for admin sync.
 */
export const getActiveChannels = query({
  args: {},
  handler: async (ctx) => {
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    return channels.map((c) => ({
      channelId: c.channelId,
      chatId: c.chatId,
      title: c.title,
      forwardChatId: c.forwardChatId,
      autoReactionEmoji: c.autoReactionEmoji,
      webAppUrl: c.webAppUrl,
    }));
  },
});

/**
 * Check if a user is authorized to access the admin panel
 * Returns true if the user is a channel administrator
 */
export const isUserAuthorized = query({
  args: {
    userId: v.number(),
    channelId: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if user is in channelAdmins table
    const admin = await ctx.db
      .query("channelAdmins")
      .withIndex("by_channel_user", (q) =>
        q.eq("channelId", args.channelId).eq("userId", args.userId)
      )
      .first();

    const isAuthorized = admin !== null;

    console.log(`Authorization check for user ${args.userId} on channel ${args.channelId}: ${isAuthorized ? "✅ AUTHORIZED" : "❌ UNAUTHORIZED"}`);

    return isAuthorized;
  },
});

/**
 * Find the channelAdmins record for a user, preferring the given channel but
 * falling back to any channel the user administers. The fallback matters when
 * the channels registry contains more than one row pointing at the same
 * discussion group (e.g. the group itself was mistakenly registered as a
 * channel): the admin's record — including their preferredName — lives under
 * the real channelId, and scoping strictly to the selected one would lose it.
 */
async function findAdminRecord(
  ctx: { db: GenericDatabaseReader<DataModel> },
  channelId: number,
  userId: number
) {
  const admin = await ctx.db
    .query("channelAdmins")
    .withIndex("by_channel_user", (q) =>
      q.eq("channelId", channelId).eq("userId", userId)
    )
    .first();
  if (admin) return admin;

  const anyChannel = await ctx.db
    .query("channelAdmins")
    .filter((q) => q.eq(q.field("userId"), userId))
    .collect();
  // Prefer a record with a preferredName set, then most recently updated.
  anyChannel.sort(
    (a, b) =>
      Number(Boolean(b.preferredName)) - Number(Boolean(a.preferredName)) ||
      b.updatedAt - a.updatedAt
  );
  return anyChannel[0] ?? null;
}

/**
 * Resolve a user's display name for supervisor/admin UI. Tries channelAdmins
 * (channel-scoped, then any channel), then falls back to the users table so a
 * former admin's name doesn't degrade to a raw Telegram ID after their
 * channelAdmins record is removed by the periodic sync.
 */
async function resolveSupervisorName(
  ctx: { db: GenericDatabaseReader<DataModel> },
  channelId: number,
  userId: number
): Promise<string | null> {
  const admin = await findAdminRecord(ctx, channelId, userId);
  if (admin) {
    const name = adminDisplayName(admin);
    if (name) return name;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .first();
  return user?.realName || user?.telegramName || null;
}

function adminDisplayName(admin: {
  preferredName?: string;
  firstName?: string;
  lastName?: string;
}): string | null {
  if (admin.preferredName) return admin.preferredName;
  const fullName = `${admin.firstName || ""} ${admin.lastName || ""}`.trim();
  return fullName || null;
}

/**
 * Get the display name for an admin
 * Returns preferredName if set, otherwise firstName + lastName
 */
export const getAdminDisplayName = query({
  args: {
    userId: v.number(),
    channelId: v.number(),
  },
  handler: async (ctx, args) => {
    const admin = await findAdminRecord(ctx, args.channelId, args.userId);

    if (!admin) {
      console.log(`Admin ${args.userId} not found in channel ${args.channelId}`);
      return null;
    }

    return adminDisplayName(admin);
  },
});

/**
 * Get the supervisor display names for a session (comma-separated Arabic).
 * Supports multiple supervisors via supervisorUserIds, falling back to the legacy
 * supervisorUserId field for existing records.
 * Returns null if no supervisor is assigned.
 */
export const getSessionSupervisorName = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
    sessionNumber: v.number(),
    channelId: v.number(),
  },
  handler: async (ctx, args) => {
    // Find the session
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_chat_post_session", (q) =>
        q.eq("chatId", args.chatId)
          .eq("postId", args.postId)
          .eq("sessionNumber", args.sessionNumber)
      )
      .first();

    if (!session) {
      return null;
    }

    // Resolve effective supervisor IDs: prefer new array, fall back to legacy single value
    let supervisorIds: number[] = [];
    if (session.supervisorUserIds && session.supervisorUserIds.length > 0) {
      supervisorIds = session.supervisorUserIds;
    } else if (session.supervisorUserId) {
      supervisorIds = [session.supervisorUserId];
    }

    if (supervisorIds.length === 0) {
      return null;
    }

    // Look up each admin and resolve their display name
    const names: string[] = [];
    for (const userId of supervisorIds) {
      const name = await resolveSupervisorName(ctx, args.channelId, userId);
      if (name) {
        names.push(name);
      } else {
        console.log(`Supervisor ${userId} not found in channel ${args.channelId}`);
      }
    }

    return names.length > 0 ? names.join("، ") : null;
  },
});

/**
 * Get the list of supervisors for a session as {userId, name} pairs.
 * Used by the UI to show each admin individually with a remove button.
 */
export const getSessionSupervisors = query({
  args: {
    chatId: v.number(),
    postId: v.number(),
    sessionNumber: v.number(),
    channelId: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_chat_post_session", (q) =>
        q.eq("chatId", args.chatId)
          .eq("postId", args.postId)
          .eq("sessionNumber", args.sessionNumber)
      )
      .first();

    if (!session) {
      return [];
    }

    let supervisorIds: number[] = [];
    if (session.supervisorUserIds && session.supervisorUserIds.length > 0) {
      supervisorIds = session.supervisorUserIds;
    } else if (session.supervisorUserId) {
      supervisorIds = [session.supervisorUserId];
    }

    const result: { userId: number; name: string }[] = [];
    for (const userId of supervisorIds) {
      const name =
        (await resolveSupervisorName(ctx, args.channelId, userId)) ||
        `#${userId}`;
      result.push({ userId, name });
    }

    return result;
  },
});

// Internal: paginates through messageAuthors for the backfill action
export const getMessageAuthorsBatch = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messageAuthors")
      .paginate({ numItems: 500, cursor: args.cursor });
  },
});

// Internal: paginates through turnQueue for the backfill action
export const getTurnQueueBatch = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("turnQueue")
      .paginate({ numItems: 500, cursor: args.cursor });
  },
});

// Internal: paginates through participationHistory for the backfill action
export const getParticipationHistoryBatch = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("participationHistory")
      .paginate({ numItems: 500, cursor: args.cursor });
  },
});

/**
 * Reads a single post import request, for the bot to resolve it and for the
 * web app to follow its progress.
 */
export const getPostImport = query({
  args: { importId: v.id("postImports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.importId);
  },
});

/**
 * Narrows the range of discussion-group message ids a post published at
 * `timestamp` can live in, using posts already known for this chat.
 *
 * Message ids grow with time, so the newest known post older than the target is
 * a lower bound and the oldest known post newer than it is an upper bound. This
 * is only an optimization — the bot falls back to the full range when a bound
 * is missing (e.g. the target predates every post on record).
 */
export const getPostSearchBounds = query({
  args: {
    chatId: v.number(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const below = await ctx.db
      .query("posts")
      .withIndex("by_chat_created", (q) =>
        q.eq("chatId", args.chatId).lt("createdAt", args.timestamp)
      )
      .order("desc")
      .first();

    const above = await ctx.db
      .query("posts")
      .withIndex("by_chat_created", (q) =>
        q.eq("chatId", args.chatId).gt("createdAt", args.timestamp)
      )
      .order("asc")
      .first();

    return {
      lower: below ? { postId: below.postId, createdAt: below.createdAt } : null,
      upper: above ? { postId: above.postId, createdAt: above.createdAt } : null,
    };
  },
});

/** Cap on messages scanned when looking for unregistered posts. */
const UNREGISTERED_SCAN_LIMIT = 16000;

/**
 * Finds halaqa posts the bot has messages for but never registered.
 *
 * A post published before the bot became a channel admin never arrived as an
 * automatic forward, so nothing created its posts row and it is missing from the
 * halaqa list. Its comments, though, were stored the moment the bot saw them:
 * the handler reads postId off the automatic forward each comment replies to,
 * which needs no posts row. Anything an old post was discussed in is therefore
 * already here, and finding it costs no Telegram call — the Bot API cannot read
 * chat history, so this is the only place old posts can be recovered from.
 *
 * The scan runs over the by_chat_post index, which is ordered by postId, so a
 * truncated scan still covers the oldest posts — exactly the ones being looked
 * for.
 */
export const getUnregisteredPosts = query({
  args: { chatId: v.number() },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messageAuthors")
      .withIndex("by_chat_post", (q) => q.eq("chatId", args.chatId))
      .take(UNREGISTERED_SCAN_LIMIT);

    const registered = new Set(
      (
        await ctx.db
          .query("posts")
          .withIndex("by_chat_created", (q) => q.eq("chatId", args.chatId))
          .collect()
      ).map((post) => post.postId)
    );

    const candidates = new Map<
      number,
      { postId: number; messageCount: number; firstMessageAt: number; lastMessageAt: number }
    >();

    for (const message of messages) {
      if (registered.has(message.postId)) continue;

      const existing = candidates.get(message.postId);
      if (!existing) {
        candidates.set(message.postId, {
          postId: message.postId,
          messageCount: 1,
          firstMessageAt: message.createdAt,
          lastMessageAt: message.createdAt,
        });
        continue;
      }

      existing.messageCount++;
      existing.firstMessageAt = Math.min(existing.firstMessageAt, message.createdAt);
      existing.lastMessageAt = Math.max(existing.lastMessageAt, message.createdAt);
    }

    return {
      posts: Array.from(candidates.values()).sort(
        (a, b) => b.firstMessageAt - a.firstMessageAt
      ),
      // Older posts are still covered when this is true; newer ones may not be.
      truncated: messages.length === UNREGISTERED_SCAN_LIMIT,
    };
  },
});
