import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Sends a message to a Telegram chat
 */
export const sendTelegramMessage = action({
  args: {
    chatId: v.number(),
    text: v.string(),
    replyToMessageId: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ messageId: number }> => {
    const botToken = process.env.BOT_TOKEN;

    if (!botToken) {
      throw new Error("BOT_TOKEN environment variable not set");
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: args.chatId,
        text: args.text,
        reply_to_message_id: args.replyToMessageId,
        parse_mode: "HTML",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send Telegram message: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description || "Unknown error"}`);
    }

    return { messageId: data.result.message_id };
  },
});

/**
 * Deletes a message from a Telegram chat
 */
export const deleteTelegramMessage = action({
  args: {
    chatId: v.number(),
    messageId: v.number(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const botToken = process.env.BOT_TOKEN;

    if (!botToken) {
      throw new Error("BOT_TOKEN environment variable not set");
    }

    const url = `https://api.telegram.org/bot${botToken}/deleteMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: args.chatId,
        message_id: args.messageId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to delete Telegram message: ${response.status} - ${errorText}`);
      // Don't throw error for delete failures (message might already be deleted)
      return { success: false };
    }

    const data = await response.json();
    return { success: data.ok === true };
  },
});

/**
 * Sends the participant list as a message to the post
 */
export const sendParticipantList = action({
  args: {
    chatId: v.number(),
    postId: v.number(),
    sessionNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get the latest session if not specified
    let sessionNumber = args.sessionNumber;

    if (sessionNumber === undefined) {
      const allSessions = await ctx.runQuery(api.queries.getAvailableSessions, {
        chatId: args.chatId,
        postId: args.postId,
      });

      if (allSessions.length === 0) {
        sessionNumber = 1;
      } else {
        // Sessions are already sorted by createdAt (newest first)
        sessionNumber = allSessions[0].sessionNumber;
      }
    }

    // Get session details (for teacher name)
    const sessions = await ctx.runQuery(api.queries.getAvailableSessions, {
      chatId: args.chatId,
      postId: args.postId,
    });

    const currentSession = sessions.find(s => s.sessionNumber === sessionNumber);
    const teacherName = currentSession?.teacherName;

    // Get participants for this session
    const userListData = await ctx.runQuery(api.queries.getUserList, {
      chatId: args.chatId,
      postId: args.postId,
      sessionNumber,
    });

    const { activeUsers, completedUsers } = userListData;

    // Format the message
    const formatMessage = () => {
      // Get the date from the first participant or use current date
      const firstUser = completedUsers[0] || activeUsers[0];
      const dateMs = Date.now(); // Use current date for the message
      const date = new Date(dateMs);
      const formattedDate = date.toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      let message = formattedDate;

      if (teacherName) {
        message += `\nالمعلمة: ${teacherName}`;
      }

      message += '\n\n';

      // Combine: completed first, then active
      const allParticipants = [...completedUsers, ...activeUsers];

      // Format each participant
      allParticipants.forEach((participant, index) => {
        const arabicNumber = (index + 1).toLocaleString('ar-EG');
        const name = participant.realName || participant.telegramName;
        const doneIcon = completedUsers.some(u => u.id === participant.id) ? ' ✅' : '';
        message += `${arabicNumber}. ${name}${doneIcon}\n`;
      });

      return message;
    };

    const messageText = formatMessage();

    // Check if there's an old participant list message
    const lastListMessage = await ctx.runQuery(api.queries.getLastListMessage, {
      chatId: args.chatId,
      postId: args.postId,
    });

    // Delete old message if it exists
    if (lastListMessage) {
      await ctx.runAction(api.actions.deleteTelegramMessage, {
        chatId: args.chatId,
        messageId: lastListMessage.messageId,
      });
    }

    // Send the new message (reply to the post)
    const result = await ctx.runAction(api.actions.sendTelegramMessage, {
      chatId: args.chatId,
      text: messageText,
      replyToMessageId: args.postId,
    });

    // Store the new message ID
    await ctx.runMutation(api.mutations.setLastListMessage, {
      chatId: args.chatId,
      postId: args.postId,
      messageId: result.messageId,
    });

    return { success: true, messageId: result.messageId };
  },
});
