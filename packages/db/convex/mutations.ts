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
        username: args.user.username,
        messageText: args.messageText,
        channelId: args.channelId,
        createdAt: Date.now(),
      });
    }
  },
});

export const addUserToList = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
    user: v.object({
      id: v.number(),
      first_name: v.string(),
      username: v.optional(v.string()),
    }),
    displayName: v.optional(v.string()),
    channelId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if user already in list
    const existing = await ctx.db
      .query("userLists")
      .withIndex("by_chat_post_user", (q) =>
        q
          .eq("chatId", args.chatId)
          .eq("postId", args.postId)
          .eq("userId", args.user.id)
      )
      .first();

    if (existing) {
      // User already in list - just update display name if provided
      if (args.displayName && args.displayName !== existing.displayName) {
        await ctx.db.patch(existing._id, {
          displayName: args.displayName,
        });
        return true; // List changed (display name updated)
      }
      return false;
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
            firstName: user.firstName,
            username: user.username,
            displayName: user.displayName,
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

    const maxPosition =
      updatedUsers.length > 0
        ? Math.max(...updatedUsers.map((u) => u.position))
        : 0;

    // Insert new user (not marked as carried over since they're actively posting)
    await ctx.db.insert("userLists", {
      chatId: args.chatId,
      postId: args.postId,
      userId: args.user.id,
      firstName: args.user.first_name,
      username: args.user.username,
      displayName: args.displayName,
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
        containsName: args.containsName,
        detectedNames: args.detectedNames,
        channelId: args.channelId,
        classifiedAt: Date.now(),
      });
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

export const updateUserDisplayName = mutation({
  args: {
    chatId: v.number(),
    postId: v.number(),
    userId: v.number(),
    displayName: v.string(),
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

    // Update display name
    await ctx.db.patch(user._id, {
      displayName: args.displayName.trim() || undefined,
    });
  },
});
