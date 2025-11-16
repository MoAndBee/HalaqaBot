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
  },
  handler: async (ctx, args) => {
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

    // Calculate next position and insert user (duplicates are now allowed)
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
    chatId: v.number(),
    postId: v.number(),
    userId: v.number(),
    newPosition: v.number(),
  },
  handler: async (ctx, args) => {
    // Get current user
    const currentUser = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post_user", (q) =>
        q
          .eq("chatId", args.chatId)
          .eq("postId", args.postId)
          .eq("userId", args.userId)
      )
      .first();

    if (!currentUser) {
      throw new Error(
        `User ${args.userId} not found in list for chat ${args.chatId}, post ${args.postId}`
      );
    }

    const currentPosition = currentUser.position;

    if (currentPosition === args.newPosition) {
      return;
    }

    // Get all users in the list
    const allUsers = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    if (args.newPosition < currentPosition) {
      // Moving up: shift users down
      const usersToShift = allUsers.filter(
        (u) =>
          u.position >= args.newPosition &&
          u.position < currentPosition &&
          u.userId !== args.userId
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
          u.userId !== args.userId
      );

      for (const user of usersToShift) {
        await ctx.db.patch(user._id, { position: user.position - 1 });
      }
    }

    // Update the target user's position
    await ctx.db.patch(currentUser._id, { position: args.newPosition });
  },
});

export const removeUserFromList = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
    userId: v.number(),
  },
  handler: async (ctx, args) => {
    // Find the user to remove
    const userToRemove = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post_user", (q) =>
        q
          .eq("chatId", args.chatId)
          .eq("postId", args.postId)
          .eq("userId", args.userId)
      )
      .first();

    if (!userToRemove) {
      throw new Error(
        `User ${args.userId} not found in list for chat ${args.chatId}, post ${args.postId}`
      );
    }

    const removedPosition = userToRemove.position;

    // Delete the user
    await ctx.db.delete(userToRemove._id);

    // Get all remaining users with higher positions
    const usersToShift = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
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
    chatId: v.number(),
    postId: v.number(),
    userId: v.number(),
    sessionType: v.string(), // "تلاوة" or "تسميع"
  },
  handler: async (ctx, args) => {
    // Find the user
    const user = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post_user", (q) =>
        q
          .eq("chatId", args.chatId)
          .eq("postId", args.postId)
          .eq("userId", args.userId)
      )
      .first();

    if (!user) {
      throw new Error(
        `User ${args.userId} not found in list for chat ${args.chatId}, post ${args.postId}`
      );
    }

    // Mark as completed
    await ctx.db.patch(user._id, {
      completedAt: Date.now(),
      sessionType: args.sessionType,
    });
  },
});

export const skipUserTurn = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
    userId: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all active (incomplete) users
    const allUsers = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post", (q) =>
        q.eq("chatId", args.chatId).eq("postId", args.postId)
      )
      .collect();

    const activeUsers = allUsers
      .filter((u) => !u.completedAt)
      .sort((a, b) => a.position - b.position);

    if (activeUsers.length < 2) {
      throw new Error("Cannot skip turn - not enough active users");
    }

    // Find current user (should be first in active users)
    const currentUser = activeUsers.find((u) => u.userId === args.userId);
    if (!currentUser) {
      throw new Error(
        `User ${args.userId} not found or already completed their turn`
      );
    }

    // Find next user (second in active users)
    const currentIndex = activeUsers.findIndex((u) => u.userId === args.userId);
    if (currentIndex === -1 || currentIndex >= activeUsers.length - 1) {
      throw new Error("Cannot skip - no next user available");
    }

    const nextUser = activeUsers[currentIndex + 1];

    // Swap positions
    const tempPosition = currentUser.position;
    await ctx.db.patch(currentUser._id, { position: nextUser.position });
    await ctx.db.patch(nextUser._id, { position: tempPosition });
  },
});

export const updateSessionType = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
    userId: v.number(),
    sessionType: v.string(), // "تلاوة" or "تسميع"
  },
  handler: async (ctx, args) => {
    // Find the user
    const user = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post_user", (q) =>
        q
          .eq("chatId", args.chatId)
          .eq("postId", args.postId)
          .eq("userId", args.userId)
      )
      .first();

    if (!user) {
      throw new Error(
        `User ${args.userId} not found in list for chat ${args.chatId}, post ${args.postId}`
      );
    }

    if (!user.completedAt) {
      throw new Error(
        `Cannot update session type for user ${args.userId} - turn not completed yet`
      );
    }

    // Update session type
    await ctx.db.patch(user._id, {
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
