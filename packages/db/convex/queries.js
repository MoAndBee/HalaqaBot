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
            .withIndex("by_chat_post_message", (q) => q
            .eq("chatId", args.chatId)
            .eq("postId", args.postId)
            .eq("messageId", args.messageId))
            .first();
        if (!message)
            return null;
        return {
            id: message.userId,
            first_name: message.firstName,
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
            .filter((q) => q.and(q.eq(q.field("chatId"), args.chatId), q.eq(q.field("messageId"), args.messageId)))
            .first();
        return message?.postId ?? null;
    },
});
export const getUserList = query({
    args: {
        chatId: v.number(),
        postId: v.number(),
    },
    handler: async (ctx, args) => {
        const users = await ctx.db
            .query("userLists")
            .withIndex("by_chat_post", (q) => q.eq("chatId", args.chatId).eq("postId", args.postId))
            .collect();
        // Sort by position
        users.sort((a, b) => a.position - b.position);
        // Separate active and completed users
        const activeUsers = users
            .filter((user) => !user.completedAt)
            .map((user) => ({
            id: user.userId,
            first_name: user.firstName,
            username: user.username,
            displayName: user.displayName,
            position: user.position,
        }));
        const completedUsers = users
            .filter((user) => user.completedAt)
            .map((user) => ({
            id: user.userId,
            first_name: user.firstName,
            username: user.username,
            displayName: user.displayName,
            position: user.position,
            completedAt: user.completedAt,
            sessionType: user.sessionType,
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
            .withIndex("by_chat_post", (q) => q.eq("chatId", args.chatId).eq("postId", args.postId))
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
            .withIndex("by_chat_post_message", (q) => q
            .eq("chatId", args.chatId)
            .eq("postId", args.postId)
            .eq("messageId", args.messageId))
            .first();
        if (!classification)
            return null;
        return {
            containsName: classification.containsName,
            detectedNames: classification.detectedNames,
        };
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
            .withIndex("by_chat_post", (q) => q.eq("chatId", args.chatId).eq("postId", args.postId))
            .collect();
        const excludedUserIds = new Set(userListUsers.map((u) => u.userId));
        // Get all classified messages
        const classifications = await ctx.db
            .query("messageClassifications")
            .withIndex("by_chat_post", (q) => q.eq("chatId", args.chatId).eq("postId", args.postId))
            .collect();
        const excludedMessageIds = new Set(classifications.map((c) => c.messageId));
        // Get all messages for this post
        const messages = await ctx.db
            .query("messageAuthors")
            .withIndex("by_chat_post", (q) => q.eq("chatId", args.chatId).eq("postId", args.postId))
            .collect();
        // Filter out users already in list and already classified messages
        const uniqueMessages = new Map();
        for (const msg of messages) {
            if (!excludedUserIds.has(msg.userId) &&
                !excludedMessageIds.has(msg.messageId) &&
                !uniqueMessages.has(msg.messageId)) {
                uniqueMessages.set(msg.messageId, {
                    messageId: msg.messageId,
                    text: msg.messageText || "",
                    user: {
                        id: msg.userId,
                        first_name: msg.firstName,
                        username: msg.username,
                    },
                });
            }
        }
        return Array.from(uniqueMessages.values()).sort((a, b) => a.messageId - b.messageId);
    },
});
export const getAllPosts = query({
    args: {},
    handler: async (ctx) => {
        const allUsers = await ctx.db.query("userLists").collect();
        const postsMap = new Map();
        for (const user of allUsers) {
            const key = `${user.chatId}-${user.postId}`;
            if (!postsMap.has(key)) {
                postsMap.set(key, {
                    chatId: user.chatId,
                    postId: user.postId,
                    userCount: 0,
                });
            }
            postsMap.get(key).userCount++;
        }
        return Array.from(postsMap.values()).sort((a, b) => {
            if (a.chatId !== b.chatId)
                return a.chatId - b.chatId;
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
            .withIndex("by_chat_post", (q) => q.eq("chatId", args.chatId).eq("postId", args.postId))
            .collect();
        if (users.length === 0)
            return null;
        const messages = await ctx.db
            .query("messageAuthors")
            .withIndex("by_chat_post", (q) => q.eq("chatId", args.chatId).eq("postId", args.postId))
            .collect();
        return {
            userCount: users.length,
            messageCount: messages.length,
        };
    },
});
