import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export default defineSchema({
    messageAuthors: defineTable({
        chatId: v.number(),
        postId: v.number(),
        messageId: v.number(),
        userId: v.number(),
        firstName: v.string(),
        username: v.optional(v.string()),
        messageText: v.optional(v.string()),
        createdAt: v.number(), // timestamp in ms
    })
        .index("by_chat_post_message", ["chatId", "postId", "messageId"])
        .index("by_chat_post", ["chatId", "postId"])
        .index("by_post", ["postId"]),
    userLists: defineTable({
        chatId: v.number(),
        postId: v.number(),
        userId: v.number(),
        firstName: v.string(),
        username: v.optional(v.string()),
        displayName: v.optional(v.string()), // Detected name from message classification
        position: v.number(),
        createdAt: v.number(), // timestamp in ms
        completedAt: v.optional(v.number()), // timestamp in ms when turn was completed
        sessionType: v.optional(v.string()), // "تلاوة" or "تسميع"
    })
        .index("by_chat_post_user", ["chatId", "postId", "userId"])
        .index("by_chat_post", ["chatId", "postId"])
        .index("by_chat_post_position", ["chatId", "postId", "position"]),
    lastListMessages: defineTable({
        chatId: v.number(),
        postId: v.number(),
        messageId: v.number(),
        updatedAt: v.number(), // timestamp in ms
    })
        .index("by_chat_post", ["chatId", "postId"]),
    messageClassifications: defineTable({
        chatId: v.number(),
        postId: v.number(),
        messageId: v.number(),
        containsName: v.boolean(),
        detectedNames: v.array(v.string()),
        classifiedAt: v.number(), // timestamp in ms
    })
        .index("by_chat_post_message", ["chatId", "postId", "messageId"])
        .index("by_chat_post", ["chatId", "postId"]),
});
