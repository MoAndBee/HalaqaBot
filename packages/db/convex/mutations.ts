import { mutation } from "./_generated/server";
import { v } from "convex/values";

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
  },
  handler: async (ctx, args) => {
    // Determine the session number to use
    let sessionNumber = args.sessionNumber;

    if (sessionNumber === undefined) {
      // Find all entries for this post
      const allEntries = await ctx.db
        .query("userLists")
        .withIndex("by_chat_post", (q) =>
          q.eq("chatId", args.chatId).eq("postId", args.postId)
        )
        .collect();

      if (allEntries.length === 0) {
        // No entries yet, start with session 1
        sessionNumber = 1;
      } else {
        // Always use the max session number (add to current/latest session)
        sessionNumber = Math.max(...allEntries.map(e => e.sessionNumber ?? 1));
      }
    }

    // Get current users in this post
    const allUsers = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    // If this is the first user being added to the post, copy incomplete users from previous post
    if (allUsers.length === 0) {
      // Find previous post in same chat
      const allPosts = await ctx.db.query("userLists").collect();
      const postsInChat = allPosts
        .filter((u) => u.chatId === args.chatId && u.postId < args.postId)
        .map((u) => u.postId);

      if (postsInChat.length > 0) {
        const previousPostId = Math.max(...postsInChat);

        // Get incomplete users from previous post
        const incompleteUsers = await ctx.db
          .query("userLists")
          .withIndex("by_chat_post", (q) =>
            q.eq("chatId", args.chatId).eq("postId", previousPostId)
          )
          .collect();

        const usersToCarryOver = incompleteUsers
          .filter((u) => !u.completedAt)
          .sort((a, b) => a.position - b.position);

        // Copy them to new post with resequenced positions and mark as carried over
        for (let i = 0; i < usersToCarryOver.length; i++) {
          const user = usersToCarryOver[i];
          await ctx.db.insert("userLists", {
            chatId: args.chatId,
            postId: args.postId,
            userId: user.userId,
            position: i + 1,
            channelId: args.channelId,
            createdAt: Date.now(),
            carriedOver: true, // Mark as carried over
            sessionNumber,
          });
        }
      }
    }

    // Get updated max position after potential carry-over
    const updatedUsers = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    // Always insert the user (allow duplicates)
    const maxPosition =
      updatedUsers.length > 0
        ? Math.max(...updatedUsers.map((u) => u.position))
        : 0;

    await ctx.db.insert("userLists", {
      chatId: args.chatId,
      postId: args.postId,
      userId: args.userId,
      position: maxPosition + 1,
      channelId: args.channelId,
      createdAt: Date.now(),
      carriedOver: false, // This is a new addition, not carried over
      sessionNumber,
    });

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
  },
  handler: async (ctx, args) => {
    // Determine the session number
    let sessionNumber = args.sessionNumber;
    if (sessionNumber === undefined) {
      const allEntries = await ctx.db
        .query("userLists")
        .withIndex("by_chat_post", (q) =>
          q.eq("chatId", args.chatId).eq("postId", args.postId)
        )
        .collect();
      sessionNumber = allEntries.length > 0
        ? Math.max(...allEntries.map(e => e.sessionNumber ?? 1))
        : 1;
    }

    // Get all users in this session
    const allUsers = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post_session", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId).eq("sessionNumber", sessionNumber)
      )
      .collect();

    // Get only active users, sorted by position
    const activeUsers = allUsers
      .filter(u => !u.completedAt)
      .sort((a, b) => a.position - b.position);

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
      // Example: currentIndex = 2, turnsToWait = 3 → targetIndex = 5
      // This means insert at index 5, which is after indexes 3, 4, 5 (wait for 3 people)
      targetIndex = currentIndex + args.turnsToWait;
    } else {
      // Case 3 & 4: DONE user
      // Insert at index 3 (4th position in active list, 0-indexed)
      targetIndex = 3;
    }

    let insertAfterPosition: number;

    // Determine where to insert based on targetIndex
    if (targetIndex >= activeUsers.length) {
      // Case 2 or Case 4: targetIndex is beyond the last active user
      // Insert after the last active user (at the end)
      insertAfterPosition = activeUsers[activeUsers.length - 1].position;
    } else {
      // Case 1 or Case 3: targetIndex is within the active users array
      // Insert before the user at targetIndex
      // Which means insert after the user at targetIndex - 1
      if (targetIndex === 0) {
        // Special case: insert before the first active user
        insertAfterPosition = 0; // Will be handled specially
      } else {
        insertAfterPosition = activeUsers[targetIndex - 1].position;
      }
    }

    // Now we need to find the actual database position to insert at
    let targetPosition: number;

    if (targetIndex >= activeUsers.length) {
      // Case 2 or Case 4: Add after the last active user
      targetPosition = activeUsers[activeUsers.length - 1].position + 1;
    } else if (targetIndex === 0) {
      // Special case: insert before first active user
      const firstActivePosition = activeUsers[0].position;
      if (firstActivePosition === 1) {
        // No room before, need to shift everyone down
        targetPosition = 1;
        // Shift all active users down by 1
        for (const user of activeUsers) {
          await ctx.db.patch(user._id, { position: user.position + 1 });
        }
      } else {
        // There's room before the first active user
        targetPosition = firstActivePosition - 1;
      }
    } else {
      // Case 1 or Case 3: Insert between active users
      const beforeUser = activeUsers[targetIndex - 1];
      const afterUser = activeUsers[targetIndex];

      if (afterUser.position === beforeUser.position + 1) {
        // No gap, need to shift users at targetIndex and after
        targetPosition = afterUser.position;
        // Shift all active users from targetIndex onwards down by 1
        for (let i = targetIndex; i < activeUsers.length; i++) {
          await ctx.db.patch(activeUsers[i]._id, { position: activeUsers[i].position + 1 });
        }
      } else {
        // There's a gap, insert in the gap
        targetPosition = beforeUser.position + 1;
      }
    }

    // Insert the new user at target position
    await ctx.db.insert("userLists", {
      chatId: args.chatId,
      postId: args.postId,
      userId: args.userId,
      position: targetPosition,
      channelId: args.channelId,
      createdAt: Date.now(),
      carriedOver: false,
      sessionNumber,
    });

    return true;
  },
});

export const clearUserList = mutation({
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

    for (const user of users) {
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
    entryId: v.id("userLists"),
    newPosition: v.number(),
  },
  handler: async (ctx, args) => {
    // Get the entry
    const currentEntry = await ctx.db.get(args.entryId);
    
    if (!currentEntry) {
      throw new Error(`Entry not found`);
    }

    const currentPosition = currentEntry.position;

    if (currentPosition === args.newPosition) {
      return;
    }

    // Get all users in this session
    const allUsers = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post_session", (q) =>
        q.eq("chatId", currentEntry.chatId).eq("postId", currentEntry.postId).eq("sessionNumber", currentEntry.sessionNumber ?? 1)
      )
      .collect();

    if (args.newPosition < currentPosition) {
      // Moving up: shift users down
      const usersToShift = allUsers.filter(
        (u) =>
          u.position >= args.newPosition &&
          u.position < currentPosition &&
          u._id !== args.entryId
      );

      for (const user of usersToShift) {
        await ctx.db.patch(user._id, { position: user.position + 1 });
      }
    } else {
      // Moving down: shift users up
      const usersToShift = allUsers.filter(
        (u) =>
          u.position > currentPosition &&
          u.position <= args.newPosition &&
          u._id !== args.entryId
      );

      for (const user of usersToShift) {
        await ctx.db.patch(user._id, { position: user.position - 1 });
      }
    }

    // Update the target user's position
    await ctx.db.patch(args.entryId, { position: args.newPosition });
  },
});

export const removeUserFromList = mutation({
  args: {
    entryId: v.id("userLists"),
  },
  handler: async (ctx, args) => {
    // Get the entry to remove
    const entryToRemove = await ctx.db.get(args.entryId);

    if (!entryToRemove) {
      throw new Error(`Entry not found`);
    }

    const removedPosition = entryToRemove.position;

    // Delete the entry
    await ctx.db.delete(args.entryId);

    // Get all remaining users in this session with higher positions
    const usersToShift = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post_session", (q) =>
        q.eq("chatId", entryToRemove.chatId).eq("postId", entryToRemove.postId).eq("sessionNumber", entryToRemove.sessionNumber ?? 1)
      )
      .collect();

    // Shift down all users with higher positions
    for (const user of usersToShift) {
      if (user.position > removedPosition) {
        await ctx.db.patch(user._id, { position: user.position - 1 });
      }
    }
  },
});

export const completeUserTurn = mutation({
  args: {
    entryId: v.id("userLists"),
    sessionType: v.string(), // "تلاوة" or "تسميع"
  },
  handler: async (ctx, args) => {
    // Get the entry
    const entry = await ctx.db.get(args.entryId);

    if (!entry) {
      throw new Error(`Entry not found`);
    }

    // Mark as completed
    await ctx.db.patch(args.entryId, {
      completedAt: Date.now(),
      sessionType: args.sessionType,
    });
  },
});

export const skipUserTurn = mutation({
  args: {
    entryId: v.id("userLists"),
  },
  handler: async (ctx, args) => {
    // Get the entry
    const currentEntry = await ctx.db.get(args.entryId);

    if (!currentEntry) {
      throw new Error(`Entry not found`);
    }

    // Get all users in this session
    const allUsers = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post_session", (q) =>
        q.eq("chatId", currentEntry.chatId).eq("postId", currentEntry.postId).eq("sessionNumber", currentEntry.sessionNumber ?? 1)
      )
      .collect();

    const activeUsers = allUsers
      .filter((u) => !u.completedAt)
      .sort((a, b) => a.position - b.position);

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

    const nextUser = activeUsers[currentIndex + 1];

    // Swap positions
    const tempPosition = currentEntry.position;
    await ctx.db.patch(args.entryId, { position: nextUser.position });
    await ctx.db.patch(nextUser._id, { position: tempPosition });
  },
});

export const updateSessionType = mutation({
  args: {
    entryId: v.id("userLists"),
    sessionType: v.string(), // "تلاوة" or "تسميع"
  },
  handler: async (ctx, args) => {
    // Get the entry
    const entry = await ctx.db.get(args.entryId);

    if (!entry) {
      throw new Error(`Entry not found`);
    }

    if (!entry.completedAt) {
      throw new Error(`Cannot update session type - turn not completed yet`);
    }

    // Update session type
    await ctx.db.patch(args.entryId, {
      sessionType: args.sessionType,
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
    carryOverIncomplete: v.optional(v.boolean()), // whether to carry over incomplete users
  },
  handler: async (ctx, args) => {
    // Get all entries for this post
    const allEntries = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    // Find the max session number (defaulting to 1 for entries without sessionNumber)
    const currentMaxSession = Math.max(
      1,
      ...allEntries.map(e => e.sessionNumber ?? 1)
    );

    const newSessionNumber = currentMaxSession + 1;

    // Store session metadata with teacher name
    await ctx.db.insert("sessions", {
      chatId: args.chatId,
      postId: args.postId,
      sessionNumber: newSessionNumber,
      teacherName: args.teacherName,
      createdAt: Date.now(),
    });

    // If carryOverIncomplete is true, copy incomplete users from previous session
    if (args.carryOverIncomplete) {
      const previousSessionEntries = allEntries.filter(
        e => (e.sessionNumber ?? 1) === currentMaxSession && !e.completedAt
      );

      // Sort by position
      previousSessionEntries.sort((a, b) => a.position - b.position);

      // Copy to new session
      for (let i = 0; i < previousSessionEntries.length; i++) {
        const entry = previousSessionEntries[i];
        await ctx.db.insert("userLists", {
          chatId: args.chatId,
          postId: args.postId,
          userId: entry.userId,
          position: i + 1,
          channelId: entry.channelId,
          createdAt: Date.now(),
          carriedOver: true,
          sessionNumber: newSessionNumber,
        });
      }
    }

    return { newSessionNumber, usersCarriedOver: args.carryOverIncomplete ? true : false };
  },
});
