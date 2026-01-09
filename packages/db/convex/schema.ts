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
    .index("by_channel_post", ["channelId", "postId"])
    .index("by_chat_message", ["chatId", "messageId"]),

  // DEPRECATED: Use turnQueue and participationHistory instead
  // Kept for backward compatibility during migration
  userLists: defineTable({
    chatId: v.number(),
    postId: v.number(),
    userId: v.number(),
    position: v.number(),
    channelId: v.optional(v.number()),
    createdAt: v.number(), // timestamp in ms
    completedAt: v.optional(v.number()), // timestamp in ms when turn was completed
    sessionType: v.optional(v.string()), // "تلاوة" (reading from Quran) or "تسميع" (recitation from memory)
    carriedOver: v.optional(v.boolean()), // true if user was carried over from previous post
    sessionNumber: v.optional(v.number()), // session number within this post (defaults to 1 for existing records)
    notes: v.optional(v.string()), // optional notes for this participant
  })
    .index("by_chat_post_user", ["chatId", "postId", "userId"])
    .index("by_chat_post", ["chatId", "postId"])
    .index("by_chat_post_position", ["chatId", "postId", "position"])
    .index("by_channel_post", ["channelId", "postId"])
    .index("by_chat_post_session", ["chatId", "postId", "sessionNumber"]),

  // Active turn queue - users waiting for their turn
  turnQueue: defineTable({
    chatId: v.number(),
    postId: v.number(),
    sessionNumber: v.number(),
    userId: v.number(),
    position: v.number(),
    channelId: v.optional(v.number()),
    createdAt: v.number(), // timestamp in ms
    carriedOver: v.optional(v.boolean()), // true if user was carried over from previous session
    sessionType: v.optional(v.string()), // "تلاوة", "تسميع", "تطبيق", "اختبار", "تعويض"
    isCompensation: v.optional(v.boolean()), // true if this turn is for compensation
    compensatingForDates: v.optional(v.array(v.number())), // array of timestamps for dates being compensated
    wasSkipped: v.optional(v.boolean()), // true if this participant has been skipped
  })
    .index("by_chat_post_session", ["chatId", "postId", "sessionNumber"])
    .index("by_chat_post_position", ["chatId", "postId", "position"])
    .index("by_chat_post", ["chatId", "postId"])
    .index("by_channel_post", ["channelId", "postId"]),

  // Historical record of all completed participations
  participationHistory: defineTable({
    chatId: v.number(),
    postId: v.number(),
    sessionNumber: v.number(),
    userId: v.number(),
    sessionType: v.string(), // "تلاوة", "تسميع", "تطبيق", "اختبار", "تعويض"
    notes: v.optional(v.string()),
    channelId: v.optional(v.number()),
    createdAt: v.number(), // timestamp in ms when user joined the queue
    completedAt: v.number(), // timestamp in ms when turn was completed
    originalPosition: v.optional(v.number()), // position in queue when they joined
    carriedOver: v.optional(v.boolean()), // true if user was carried over from previous session
    isCompensation: v.optional(v.boolean()), // true if this participation is for compensation
    compensatingForDates: v.optional(v.array(v.number())), // array of timestamps for dates being compensated
  })
    .index("by_chat_post_session", ["chatId", "postId", "sessionNumber"])
    .index("by_chat_post", ["chatId", "postId"])
    .index("by_user", ["userId"])
    .index("by_channel_post", ["channelId", "postId"]),

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
    activityType: v.optional(v.string()), // "تسميع" (recitation from memory) or "تلاوة" (reading from Quran)
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
    supervisorName: v.optional(v.string()), // Name of the supervisor for this session
    createdAt: v.number(), // timestamp in ms
  })
    .index("by_chat_post", ["chatId", "postId"])
    .index("by_chat_post_session", ["chatId", "postId", "sessionNumber"]),

  botTasks: defineTable({
    type: v.string(), // "send_participant_list"
    chatId: v.number(),
    postId: v.number(),
    sessionNumber: v.optional(v.number()),
    status: v.string(), // "pending", "processing", "completed", "failed"
    resultMessageId: v.optional(v.number()), // message ID after sending
    error: v.optional(v.string()), // error message if failed
    createdAt: v.number(), // timestamp in ms
    processedAt: v.optional(v.number()), // timestamp when processed
  })
    .index("by_status", ["status"])
    .index("by_chat_post", ["chatId", "postId"]),

  // Channel administrators cache for authorization
  channelAdmins: defineTable({
    channelId: v.number(), // Telegram channel ID
    userId: v.number(), // Admin user ID
    status: v.string(), // "creator" or "administrator"
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    username: v.optional(v.string()),
    updatedAt: v.number(), // Last sync timestamp
  })
    .index("by_channel", ["channelId"])
    .index("by_channel_user", ["channelId", "userId"]),
});
