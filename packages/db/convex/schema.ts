import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messageAuthors: defineTable({
    chatId: v.number(),
    postId: v.number(),
    messageId: v.number(),
    userId: v.number(),
    firstName: v.string(),
    lastName: v.optional(v.string()),
    username: v.optional(v.string()),
    messageText: v.optional(v.string()),
    channelId: v.optional(v.number()),
    createdAt: v.number(), // timestamp in ms
  })
    .index("by_chat_post_message", ["chatId", "postId", "messageId"])
    .index("by_chat_post", ["chatId", "postId"])
    .index("by_post", ["postId"])
    .index("by_channel_post", ["channelId", "postId"]),

  userLists: defineTable({
    chatId: v.number(),
    postId: v.number(),
    userId: v.number(),
    position: v.number(),
    channelId: v.optional(v.number()),
    createdAt: v.number(), // timestamp in ms
    completedAt: v.optional(v.number()), // timestamp in ms when turn was completed
    sessionType: v.optional(v.string()), // "تلاوة" or "تسميع"
    carriedOver: v.optional(v.boolean()), // true if user was carried over from previous post
    sessionNumber: v.optional(v.number()), // session number within this post (defaults to 1 for existing records)
    notes: v.optional(v.string()), // optional notes for this participant
  })
    .index("by_chat_post_user", ["chatId", "postId", "userId"])
    .index("by_chat_post", ["chatId", "postId"])
    .index("by_chat_post_position", ["chatId", "postId", "position"])
    .index("by_channel_post", ["channelId", "postId"])
    .index("by_chat_post_session", ["chatId", "postId", "sessionNumber"]),

  lastListMessages: defineTable({
    chatId: v.number(),
    postId: v.number(),
    messageId: v.number(),
    channelId: v.optional(v.number()),
    updatedAt: v.number(), // timestamp in ms
  })
    .index("by_chat_post", ["chatId", "postId"])
    .index("by_channel_post", ["channelId", "postId"]),

  messageClassifications: defineTable({
    chatId: v.number(),
    postId: v.number(),
    messageId: v.number(),
    messageText: v.optional(v.string()),
    containsName: v.boolean(),
    detectedNames: v.array(v.string()),
    channelId: v.optional(v.number()),
    classifiedAt: v.number(), // timestamp in ms
  })
    .index("by_chat_post_message", ["chatId", "postId", "messageId"])
    .index("by_chat_post", ["chatId", "postId"])
    .index("by_channel_post", ["channelId", "postId"]),

  users: defineTable({
    userId: v.number(),
    username: v.optional(v.string()), // Telegram username (@username)
    telegramName: v.string(), // Concatenation of firstName + lastName from Telegram
    realName: v.optional(v.string()), // AI-detected name from messages
    realNameVerified: v.optional(v.boolean()), // Whether the real name has been verified
    sourceMessageText: v.optional(v.string()), // The message text from which realName was detected
    updatedAt: v.number(), // timestamp in ms
  })
    .index("by_user_id", ["userId"]),

  sessions: defineTable({
    chatId: v.number(),
    postId: v.number(),
    sessionNumber: v.number(),
    teacherName: v.string(), // Name of the teacher for this session
    createdAt: v.number(), // timestamp in ms
  })
    .index("by_chat_post", ["chatId", "postId"])
    .index("by_chat_post_session", ["chatId", "postId", "sessionNumber"]),
});
