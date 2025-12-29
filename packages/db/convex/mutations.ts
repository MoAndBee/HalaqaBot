import { mutation } from "./_generated/server";
import { v } from "convex/values";
import type { GenericMutationCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";

/**
 * Helper function to resequence active users to have contiguous positions [1, 2, 3, 4...]
 * This ensures frontend array indices always match database positions.
 */
async function resequenceActiveUsers(
  ctx: GenericMutationCtx<DataModel>,
  chatId: number,
  postId: number,
  sessionNumber: number
): Promise<void> {
  // Get all users in the turn queue for this session
  const activeUsers = await ctx.db
    .query("turnQueue")
    .withIndex("by_chat_post_session", (q) =>
      q.eq("chatId", chatId).eq("postId", postId).eq("sessionNumber", sessionNumber)
    )
    .collect();

  // Sort by position
  activeUsers.sort((a, b) => a.position - b.position);

  // Resequence positions to be [1, 2, 3, 4...]
  for (let i = 0; i < activeUsers.length; i++) {
    const expectedPosition = i + 1;
    if (activeUsers[i].position !== expectedPosition) {
      await ctx.db.patch(activeUsers[i]._id, { position: expectedPosition });
    }
  }
}

export const addMessageAuthor = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
    messageId: v.number(),
    user: v.object({
      id: v.number(),
      first_name: v.string(),
      last_name: v.optional(v.string()),
      username: v.optional(v.string()),
    }),
    messageText: v.optional(v.string()),
    channelId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if message author already exists
    const existing = await ctx.db
      .query("messageAuthors")
      .withIndex("by_chat_post_message", (q) =>
        q
          .eq("chatId", args.chatId)
          .eq("postId", args.postId)
          .eq("messageId", args.messageId)
      )
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        userId: args.user.id,
        firstName: args.user.first_name,
        lastName: args.user.last_name,
        username: args.user.username,
        messageText: args.messageText,
        channelId: args.channelId,
        createdAt: Date.now(),
      });
    } else {
      // Insert new record
      await ctx.db.insert("messageAuthors", {
        chatId: args.chatId,
        postId: args.postId,
        messageId: args.messageId,
        userId: args.user.id,
        firstName: args.user.first_name,
        lastName: args.user.last_name,
        username: args.user.username,
        messageText: args.messageText,
        channelId: args.channelId,
        createdAt: Date.now(),
      });
    }

    // Also upsert to users table (only if user ID is valid)
    if (args.user.id !== 0) {
      // Construct telegramName
      const telegramName = args.user.last_name
        ? `${args.user.first_name} ${args.user.last_name}`
        : args.user.first_name;

      // Check if user already exists in users table
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_user_id", (q) => q.eq("userId", args.user.id))
        .first();

      if (existingUser) {
        // Update existing user (only update Telegram info, don't overwrite realName)
        await ctx.db.patch(existingUser._id, {
          username: args.user.username,
          telegramName: telegramName,
          updatedAt: Date.now(),
        });
      } else {
        // Insert new user (without realName for now, it will be populated later)
        await ctx.db.insert("users", {
          userId: args.user.id,
          username: args.user.username,
          telegramName: telegramName,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

export const addUserToList = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
    userId: v.number(),
    channelId: v.optional(v.number()),
    sessionNumber: v.optional(v.number()), // if not provided, use latest session
    sessionType: v.optional(v.string()), // "تلاوة", "تسميع", "تطبيق", "اختبار", or "تعويض"
    isCompensation: v.optional(v.boolean()), // true if this is a compensation turn
    compensatingForDates: v.optional(v.array(v.number())), // array of timestamps for dates being compensated
  },
  handler: async (ctx, args) => {
    // Determine the session number to use
    let sessionNumber = args.sessionNumber;

    if (sessionNumber === undefined) {
      // Find latest session from sessions table
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

    // Get current users in turnQueue for this post to calculate max position
    const queueUsers = await ctx.db
      .query("turnQueue")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    // Always insert the user (allow duplicates)
    const maxPosition =
      queueUsers.length > 0
        ? Math.max(...queueUsers.map((u) => u.position))
        : 0;

    await ctx.db.insert("turnQueue", {
      chatId: args.chatId,
      postId: args.postId,
      sessionNumber,
      userId: args.userId,
      position: maxPosition + 1,
      channelId: args.channelId,
      createdAt: Date.now(),
      carriedOver: false, // This is a new addition, not carried over
      sessionType: args.sessionType,
      isCompensation: args.isCompensation,
      compensatingForDates: args.compensatingForDates,
    });

    // Ensure the session exists in the sessions table
    const existingSession = await ctx.db
      .query("sessions")
      .withIndex("by_chat_post_session", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId).eq("sessionNumber", sessionNumber)
      )
      .first();

    if (!existingSession) {
      await ctx.db.insert("sessions", {
        chatId: args.chatId,
        postId: args.postId,
        sessionNumber,
        teacherName: "",
        createdAt: Date.now(),
      });
    }

    return true;
  },
});

export const addUserAtPosition = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
    userId: v.number(),
    currentPosition: v.optional(v.number()), // For NOT DONE users: their current position. For DONE users: undefined
    turnsToWait: v.number(), // How many turns to wait (e.g., 3 means skip 3 users)
    channelId: v.optional(v.number()),
    sessionNumber: v.optional(v.number()),
    sessionType: v.optional(v.string()), // "تلاوة", "تسميع", "تطبيق", "اختبار", or "تعويض"
    isCompensation: v.optional(v.boolean()),
    compensatingForDates: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    // Determine the session number
    let sessionNumber = args.sessionNumber;
    if (sessionNumber === undefined) {
      // Find latest session from sessions table
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

    // Get all active users in the turn queue for this session
    const activeUsers = await ctx.db
      .query("turnQueue")
      .withIndex("by_chat_post_session", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId).eq("sessionNumber", sessionNumber)
      )
      .collect();

    // Sort by position
    activeUsers.sort((a, b) => a.position - b.position);

    if (activeUsers.length === 0) {
      throw new Error("No active users in session");
    }

    let targetIndex: number;

    if (args.currentPosition !== undefined) {
      // Case 1 & 2: NOT DONE user
      // Find the index of the current user in the active users list
      const currentIndex = activeUsers.findIndex(u => u.position === args.currentPosition);

      if (currentIndex === -1) {
        throw new Error(`User at position ${args.currentPosition} not found in active users`);
      }

      // Calculate target index: skip turnsToWait active users after current
      // Example: currentIndex = 2, turnsToWait = 3 → targetIndex = 6 (insert after waiting for 3 users)
      targetIndex = Math.min(currentIndex + args.turnsToWait + 1, activeUsers.length);
    } else {
      // Case 3 & 4: DONE user
      // Insert at index 3 (4th position in active list, 0-indexed)
      targetIndex = Math.min(3, activeUsers.length);
    }

    // Create a temporary position (will be resequenced anyway)
    const tempPosition = activeUsers.length > 0
      ? Math.max(...activeUsers.map(u => u.position)) + 1
      : 1;

    // Insert the new user with a temporary position into turnQueue
    const newEntry = await ctx.db.insert("turnQueue", {
      chatId: args.chatId,
      postId: args.postId,
      sessionNumber,
      userId: args.userId,
      position: tempPosition,
      channelId: args.channelId,
      createdAt: Date.now(),
      carriedOver: false,
      sessionType: args.sessionType,
      isCompensation: args.isCompensation,
      compensatingForDates: args.compensatingForDates,
    });

    // Get the newly inserted entry
    const insertedEntry = await ctx.db.get(newEntry);
    if (!insertedEntry) {
      throw new Error("Failed to retrieve inserted entry");
    }

    // Add the new entry to the active users array at the target index
    activeUsers.splice(targetIndex, 0, insertedEntry);

    // Resequence all active users (including the newly added one)
    for (let i = 0; i < activeUsers.length; i++) {
      await ctx.db.patch(activeUsers[i]._id, { position: i + 1 });
    }

    return true;
  },
});

export const clearUserList = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
  },
  handler: async (ctx, args) => {
    // Delete from turnQueue
    const queueUsers = await ctx.db
      .query("turnQueue")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    for (const user of queueUsers) {
      await ctx.db.delete(user._id);
    }

    // Delete from participationHistory
    const completedUsers = await ctx.db
      .query("participationHistory")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    for (const user of completedUsers) {
      await ctx.db.delete(user._id);
    }
  },
});

export const setLastListMessage = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
    messageId: v.number(),
    channelId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("lastListMessages")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        messageId: args.messageId,
        channelId: args.channelId,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("lastListMessages", {
        chatId: args.chatId,
        postId: args.postId,
        messageId: args.messageId,
        channelId: args.channelId,
        updatedAt: Date.now(),
      });
    }
  },
});

export const clearLastListMessage = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("lastListMessages")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const storeClassification = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
    messageId: v.number(),
    messageText: v.optional(v.string()),
    containsName: v.boolean(),
    detectedNames: v.array(v.string()),
    activityType: v.optional(v.string()),
    channelId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messageClassifications")
      .withIndex("by_chat_post_message", (q) =>
        q
          .eq("chatId", args.chatId)
          .eq("postId", args.postId)
          .eq("messageId", args.messageId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        messageText: args.messageText,
        containsName: args.containsName,
        detectedNames: args.detectedNames,
        activityType: args.activityType,
        channelId: args.channelId,
        classifiedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("messageClassifications", {
        chatId: args.chatId,
        postId: args.postId,
        messageId: args.messageId,
        messageText: args.messageText,
        containsName: args.containsName,
        detectedNames: args.detectedNames,
        activityType: args.activityType,
        channelId: args.channelId,
        classifiedAt: Date.now(),
      });
    }

    // If names were detected, update the user's realName in users table
    // BUT only if the user doesn't already have a realName
    if (args.containsName && args.detectedNames.length > 0) {
      console.log(`[storeClassification] Names detected, attempting to update user realName...`);
      console.log(`   detectedNames:`, args.detectedNames);

      // Get the message author to find the userId
      const messageAuthor = await ctx.db
        .query("messageAuthors")
        .withIndex("by_chat_post_message", (q) =>
          q
            .eq("chatId", args.chatId)
            .eq("postId", args.postId)
            .eq("messageId", args.messageId)
        )
        .first();

      console.log(`   messageAuthor found: ${!!messageAuthor}, userId: ${messageAuthor?.userId}`);

      if (messageAuthor && messageAuthor.userId !== 0) {
        // Get existing user
        const existingUser = await ctx.db
          .query("users")
          .withIndex("by_user_id", (q) => q.eq("userId", messageAuthor.userId))
          .first();

        console.log(`   existingUser found: ${!!existingUser}, has realName: ${!!existingUser?.realName}`);

        // Only set realName if user exists AND doesn't have a realName yet
        if (existingUser && !existingUser.realName) {
          // Join all detected names to form full name, cleaning up commas
          const fullName = args.detectedNames
            .join(' ')
            .replace(/،/g, ' ') // Replace Arabic comma with space
            .replace(/,/g, ' ') // Replace English comma with space
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();

          console.log(`   ✅ Updating user ${messageAuthor.userId} with realName: "${fullName}"`);

          await ctx.db.patch(existingUser._id, {
            realName: fullName,
            sourceMessageText: messageAuthor.messageText,
            updatedAt: Date.now(),
          });

          console.log(`   ✅ realName updated successfully`);
        } else if (existingUser && existingUser.realName) {
          console.log(`   ⏭️ User already has realName: ${existingUser.realName}, skipping update`);
        } else {
          console.log(`   ⚠️ User not found in users table`);
        }
      } else if (!messageAuthor) {
        console.log(`   ⚠️ messageAuthor not found in database`);
      } else if (messageAuthor.userId === 0) {
        console.log(`   ⏭️ Skipping userId 0 (anonymous user)`);
      }
    }
  },
});

export const updateUserPosition = mutation({
  args: {
    entryId: v.id("turnQueue"),
    newPosition: v.number(),
  },
  handler: async (ctx, args) => {
    // Get the entry from turnQueue
    const currentEntry = await ctx.db.get(args.entryId);

    if (!currentEntry) {
      throw new Error(`Entry not found`);
    }

    const sessionNumber = currentEntry.sessionNumber;

    // Get all active users in the turn queue for this session
    const activeUsers = await ctx.db
      .query("turnQueue")
      .withIndex("by_chat_post_session", (q) =>
        q.eq("chatId", currentEntry.chatId).eq("postId", currentEntry.postId).eq("sessionNumber", sessionNumber)
      )
      .collect();

    // Sort by position
    activeUsers.sort((a, b) => a.position - b.position);

    // Find the current index in the active users array (0-indexed)
    const oldIndex = activeUsers.findIndex(u => u._id === args.entryId);
    if (oldIndex === -1) {
      throw new Error("Entry not found in active users");
    }

    // newPosition is the desired final position (1-indexed), convert to 0-indexed
    const newIndex = args.newPosition - 1;

    // Validate new position
    if (newIndex < 0 || newIndex >= activeUsers.length) {
      throw new Error(`Invalid position: ${args.newPosition}`);
    }

    if (oldIndex === newIndex) {
      return;
    }

    // Reorder the array using the same logic as frontend's arrayMove
    const [movedUser] = activeUsers.splice(oldIndex, 1);
    activeUsers.splice(newIndex, 0, movedUser);

    // Resequence all active users to [1, 2, 3, 4...]
    for (let i = 0; i < activeUsers.length; i++) {
      await ctx.db.patch(activeUsers[i]._id, { position: i + 1 });
    }
  },
});

export const removeUserFromList = mutation({
  args: {
    entryId: v.id("turnQueue"),
  },
  handler: async (ctx, args) => {
    // Get the entry to remove from turnQueue
    const entryToRemove = await ctx.db.get(args.entryId);

    if (!entryToRemove) {
      throw new Error(`Entry not found`);
    }

    const sessionNumber = entryToRemove.sessionNumber;

    // Delete the entry
    await ctx.db.delete(args.entryId);

    // Resequence remaining active users to close the gap
    await resequenceActiveUsers(
      ctx,
      entryToRemove.chatId,
      entryToRemove.postId,
      sessionNumber
    );
  },
});

export const completeUserTurn = mutation({
  args: {
    entryId: v.id("turnQueue"),
    sessionType: v.string(), // "تلاوة", "تسميع", "تطبيق", "اختبار", or "تعويض"
    isCompensation: v.optional(v.boolean()), // Override/set compensation at completion
    compensatingForDates: v.optional(v.array(v.number())), // Override/set dates at completion
  },
  handler: async (ctx, args) => {
    // Get the entry from turnQueue
    const entry = await ctx.db.get(args.entryId);

    if (!entry) {
      throw new Error(`Entry not found`);
    }

    const sessionNumber = entry.sessionNumber;

    // Determine final compensation status and dates
    // Priority: explicit args > entry values
    const isCompensation = args.isCompensation !== undefined
      ? args.isCompensation
      : entry.isCompensation || false;
    const compensatingForDates = args.compensatingForDates !== undefined
      ? args.compensatingForDates
      : entry.compensatingForDates;

    // Validation: If marked as compensation (either sessionType or isCompensation), must have dates
    if ((args.sessionType === "تعويض" || isCompensation) && (!compensatingForDates || compensatingForDates.length === 0)) {
      throw new Error("Compensation participations must have at least one date selected");
    }

    // Get the post's creation date from the first message
    const firstMessage = await ctx.db
      .query("messageAuthors")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", entry.chatId).eq("postId", entry.postId)
      )
      .first();

    // Use post creation date as completedAt, fallback to current time if not found
    const completedAt = firstMessage?.createdAt ?? Date.now();

    // Remove from turnQueue
    await ctx.db.delete(args.entryId);

    // Add to participationHistory
    await ctx.db.insert("participationHistory", {
      chatId: entry.chatId,
      postId: entry.postId,
      sessionNumber,
      userId: entry.userId,
      sessionType: args.sessionType,
      notes: undefined,
      channelId: entry.channelId,
      createdAt: entry.createdAt,
      completedAt,
      originalPosition: entry.position,
      carriedOver: entry.carriedOver,
      isCompensation,
      compensatingForDates,
    });

    // Resequence remaining active users to close the gap
    await resequenceActiveUsers(
      ctx,
      entry.chatId,
      entry.postId,
      sessionNumber
    );
  },
});

export const skipUserTurn = mutation({
  args: {
    entryId: v.id("turnQueue"),
  },
  handler: async (ctx, args) => {
    // Get the entry from turnQueue
    const currentEntry = await ctx.db.get(args.entryId);

    if (!currentEntry) {
      throw new Error(`Entry not found`);
    }

    const sessionNumber = currentEntry.sessionNumber;

    // Get all active users in the turn queue for this session
    const activeUsers = await ctx.db
      .query("turnQueue")
      .withIndex("by_chat_post_session", (q) =>
        q.eq("chatId", currentEntry.chatId).eq("postId", currentEntry.postId).eq("sessionNumber", sessionNumber)
      )
      .collect();

    // Sort by position
    activeUsers.sort((a, b) => a.position - b.position);

    if (activeUsers.length < 2) {
      throw new Error("Cannot skip turn - not enough active users");
    }

    // Find current user
    const currentIndex = activeUsers.findIndex((u) => u._id === args.entryId);
    if (currentIndex === -1) {
      throw new Error(`Entry not found or already completed`);
    }

    if (currentIndex >= activeUsers.length - 1) {
      throw new Error("Cannot skip - no next user available");
    }

    // Mark the user as skipped
    await ctx.db.patch(args.entryId, { wasSkipped: true });

    // Swap positions in the array
    [activeUsers[currentIndex], activeUsers[currentIndex + 1]] =
      [activeUsers[currentIndex + 1], activeUsers[currentIndex]];

    // Resequence all active users to reflect the swap
    for (let i = 0; i < activeUsers.length; i++) {
      await ctx.db.patch(activeUsers[i]._id, { position: i + 1 });
    }
  },
});

export const updateSessionType = mutation({
  args: {
    entryId: v.id("participationHistory"),
    sessionType: v.string(), // "تلاوة", "تسميع", "تطبيق", "اختبار", or "تعويض"
  },
  handler: async (ctx, args) => {
    // Get the entry from participationHistory
    const entry = await ctx.db.get(args.entryId);

    if (!entry) {
      throw new Error(`Entry not found`);
    }

    // If changing FROM تعويض to another type, clear compensation fields
    // If changing TO تعويض, keep existing compensation fields (they should be set via compensation modal)
    const isChangingFromCompensation = entry.isCompensation && args.sessionType !== 'تعويض';

    // Update session type
    await ctx.db.patch(args.entryId, {
      sessionType: args.sessionType,
      ...(isChangingFromCompensation && {
        isCompensation: false,
        compensatingForDates: undefined,
      }),
    });
  },
});

export const updateTurnQueueSessionType = mutation({
  args: {
    entryId: v.id("turnQueue"),
    sessionType: v.string(), // "تلاوة", "تسميع", "تطبيق", "اختبار", or "تعويض"
  },
  handler: async (ctx, args) => {
    // Get the entry from turnQueue
    const entry = await ctx.db.get(args.entryId);

    if (!entry) {
      throw new Error(`Entry not found in turn queue`);
    }

    // If changing FROM تعويض to another type, clear compensation fields
    // If changing TO تعويض, keep existing compensation fields (they should be set via compensation modal)
    const isChangingFromCompensation = entry.isCompensation && args.sessionType !== 'تعويض';

    // Update session type
    await ctx.db.patch(args.entryId, {
      sessionType: args.sessionType,
      ...(isChangingFromCompensation && {
        isCompensation: false,
        compensatingForDates: undefined,
      }),
    });
  },
});

export const updateUserRealName = mutation({
  args: {
    userId: v.number(),
    realName: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the user in the users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      throw new Error(
        `User ${args.userId} not found in users table`
      );
    }

    // Update real name and mark as verified
    await ctx.db.patch(user._id, {
      realName: args.realName.trim() || undefined,
      realNameVerified: true,
      updatedAt: Date.now(),
    });
  },
});

export const updateUserTelegramName = mutation({
  args: {
    userId: v.number(),
    telegramName: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the user in the users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      throw new Error(
        `User ${args.userId} not found in users table`
      );
    }

    // Update telegram name in users table
    await ctx.db.patch(user._id, {
      telegramName: args.telegramName.trim(),
      updatedAt: Date.now(),
    });
  },
});

export const updateUserNotes = mutation({
  args: {
    entryId: v.id("participationHistory"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the entry from participationHistory
    const entry = await ctx.db.get(args.entryId);

    if (!entry) {
      throw new Error(`Entry not found`);
    }

    // Update notes (trim and set to undefined if empty)
    await ctx.db.patch(args.entryId, {
      notes: args.notes.trim() || undefined,
    });
  },
});

export const setTurnQueueCompensation = mutation({
  args: {
    entryId: v.id("turnQueue"),
    isCompensation: v.boolean(),
    compensatingForDates: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    // Get the entry from turnQueue
    const entry = await ctx.db.get(args.entryId);

    if (!entry) {
      throw new Error(`Entry not found in turn queue`);
    }

    // Validation: if setting compensation, must have dates
    if (args.isCompensation && args.compensatingForDates.length === 0) {
      throw new Error("Compensation must have at least one date selected");
    }

    // Update compensation fields and sessionType
    await ctx.db.patch(args.entryId, {
      isCompensation: args.isCompensation,
      compensatingForDates: args.isCompensation ? args.compensatingForDates : undefined,
      sessionType: args.isCompensation ? 'تعويض' : entry.sessionType,
    });
  },
});

export const updateParticipationCompensation = mutation({
  args: {
    entryId: v.id("participationHistory"),
    isCompensation: v.boolean(),
    compensatingForDates: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    // Get the entry from participationHistory
    const entry = await ctx.db.get(args.entryId);

    if (!entry) {
      throw new Error(`Entry not found in participation history`);
    }

    // Validation: if setting compensation, must have dates
    if (args.isCompensation && args.compensatingForDates.length === 0) {
      throw new Error("Compensation must have at least one date selected");
    }

    // Update compensation fields and sessionType
    await ctx.db.patch(args.entryId, {
      isCompensation: args.isCompensation,
      compensatingForDates: args.isCompensation ? args.compensatingForDates : undefined,
      sessionType: args.isCompensation ? 'تعويض' : entry.sessionType,
    });
  },
});

export const upsertUser = mutation({
  args: {
    userId: v.number(),
    username: v.optional(v.string()),
    telegramName: v.string(),
    realName: v.optional(v.string()),
    sourceMessageText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      // Update existing user
      await ctx.db.patch(existing._id, {
        username: args.username,
        telegramName: args.telegramName,
        realName: args.realName,
        sourceMessageText: args.sourceMessageText,
        updatedAt: Date.now(),
      });
      return { created: false, userId: args.userId };
    } else {
      // Insert new user
      await ctx.db.insert("users", {
        userId: args.userId,
        username: args.username,
        telegramName: args.telegramName,
        realName: args.realName,
        sourceMessageText: args.sourceMessageText,
        updatedAt: Date.now(),
      });
      return { created: true, userId: args.userId };
    }
  },
});

export const startNewSession = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
    teacherName: v.string(), // name of the teacher for this session
    supervisorName: v.string(), // name of the supervisor for this session
    carryOverIncomplete: v.optional(v.boolean()), // whether to carry over incomplete users
  },
  handler: async (ctx, args) => {
    // Get all existing sessions for this post
    const allSessions = await ctx.db
      .query("sessions")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    // Find the max session number from sessions table
    const currentMaxSession = allSessions.length > 0
      ? Math.max(...allSessions.map(s => s.sessionNumber))
      : 0;

    const newSessionNumber = currentMaxSession + 1;

    // Store session metadata with teacher name
    await ctx.db.insert("sessions", {
      chatId: args.chatId,
      postId: args.postId,
      sessionNumber: newSessionNumber,
      teacherName: args.teacherName,
      supervisorName: args.supervisorName,
      createdAt: Date.now(),
    });

    // If carryOverIncomplete is true, copy incomplete users from previous session turnQueue
    if (args.carryOverIncomplete) {
      const previousQueueEntries = await ctx.db
        .query("turnQueue")
        .withIndex("by_chat_post_session", (q) =>
          q.eq("chatId", args.chatId).eq("postId", args.postId).eq("sessionNumber", currentMaxSession)
        )
        .collect();

      // Sort by position
      previousQueueEntries.sort((a, b) => a.position - b.position);

      // Copy to new session in turnQueue
      for (let i = 0; i < previousQueueEntries.length; i++) {
        const entry = previousQueueEntries[i];
        await ctx.db.insert("turnQueue", {
          chatId: args.chatId,
          postId: args.postId,
          sessionNumber: newSessionNumber,
          userId: entry.userId,
          position: i + 1,
          channelId: entry.channelId,
          createdAt: Date.now(),
          carriedOver: true,
          sessionType: entry.sessionType,
          isCompensation: entry.isCompensation,
          compensatingForDates: entry.compensatingForDates,
        });
      }
    }

    return { newSessionNumber, usersCarriedOver: args.carryOverIncomplete ? true : false };
  },
});

export const updateSessionTeacher = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
    sessionNumber: v.number(),
    teacherName: v.string(),
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
      // If session doesn't exist, create it with the teacher name and no supervisor name
      await ctx.db.insert("sessions", {
        chatId: args.chatId,
        postId: args.postId,
        sessionNumber: args.sessionNumber,
        teacherName: args.teacherName,
        createdAt: Date.now(),
      });
      return { created: true };
    }

    // Update the existing session's teacher name
    await ctx.db.patch(session._id, {
      teacherName: args.teacherName,
    });

    return { created: false };
  },
});

export const updateSessionSupervisor = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
    sessionNumber: v.number(),
    supervisorName: v.string(),
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
      // If session doesn't exist, create it with the supervisor name and no teacher name
      await ctx.db.insert("sessions", {
        chatId: args.chatId,
        postId: args.postId,
        sessionNumber: args.sessionNumber,
        teacherName: "", // Default empty teacher name (required field)
        supervisorName: args.supervisorName,
        createdAt: Date.now(),
      });
      return { created: true };
    }

    // Update the existing session's supervisor name
    await ctx.db.patch(session._id, {
      supervisorName: args.supervisorName,
    });

    return { created: false };
  },
});

export const createBotTask = mutation({
  args: {
    type: v.string(),
    chatId: v.number(),
    postId: v.number(),
    sessionNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("botTasks", {
      type: args.type,
      chatId: args.chatId,
      postId: args.postId,
      sessionNumber: args.sessionNumber,
      status: "pending",
      createdAt: Date.now(),
    });

    return { taskId };
  },
});

export const updateBotTask = mutation({
  args: {
    taskId: v.id("botTasks"),
    status: v.string(),
    resultMessageId: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      status: args.status,
      resultMessageId: args.resultMessageId,
      error: args.error,
      processedAt: Date.now(),
    });
  },
});
