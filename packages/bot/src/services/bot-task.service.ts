import type { Bot } from "grammy";
import { ConvexHttpClient, api } from "@halakabot/db";

export class BotTaskService {
  private bot: Bot;
  private convex: ConvexHttpClient;
  private isProcessing = false;

  constructor(bot: Bot, convex: ConvexHttpClient) {
    this.bot = bot;
    this.convex = convex;
  }

  /**
   * Start watching for pending bot tasks and process them
   */
  async start() {
    console.log("Bot task service started, watching for tasks...");

    // Poll for pending tasks every 2 seconds
    setInterval(async () => {
      if (this.isProcessing) return;

      try {
        await this.processPendingTasks();
      } catch (error) {
        console.error("Error processing bot tasks:", error);
      }
    }, 2000);
  }

  private async processPendingTasks() {
    this.isProcessing = true;

    try {
      // Get all pending tasks
      const tasks = await this.convex.query(api.queries.getPendingBotTasks, {});

      for (const task of tasks) {
        await this.processTask(task);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processTask(task: any) {
    console.log(`Processing bot task: ${task.type}`, task);

    // Mark as processing
    await this.convex.mutation(api.mutations.updateBotTask, {
      taskId: task._id,
      status: "processing",
    });

    try {
      if (task.type === "send_participant_list") {
        await this.handleSendParticipantList(task);
      } else {
        throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error) {
      console.error(`Failed to process task ${task._id}:`, error);

      // Mark as failed
      await this.convex.mutation(api.mutations.updateBotTask, {
        taskId: task._id,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private async handleSendParticipantList(task: any) {
    const { chatId, postId } = task;
    let { sessionNumber } = task;

    // Get the latest session if not specified
    if (sessionNumber === undefined) {
      const allSessions = await this.convex.query(api.queries.getAvailableSessions, {
        chatId,
        postId,
      });

      if (allSessions.length === 0) {
        sessionNumber = 1;
      } else {
        sessionNumber = allSessions[0].sessionNumber;
      }
    }

    // Get session details (for teacher name)
    const sessions = await this.convex.query(api.queries.getAvailableSessions, {
      chatId,
      postId,
    });

    const currentSession = sessions.find((s: any) => s.sessionNumber === sessionNumber);
    const teacherName = currentSession?.teacherName;

    // Get participants for this session
    const userListData = await this.convex.query(api.queries.getUserList, {
      chatId,
      postId,
      sessionNumber,
    });

    const { activeUsers, completedUsers } = userListData;

    // Format the message
    const formatMessage = () => {
      const dateMs = Date.now();
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
      allParticipants.forEach((participant: any, index: number) => {
        const arabicNumber = (index + 1).toLocaleString('ar-EG');
        const name = participant.realName || participant.telegramName;
        const doneIcon = completedUsers.some((u: any) => u.id === participant.id) ? ' ✅' : '';
        message += `${arabicNumber}. ${name}${doneIcon}\n`;
      });

      return message;
    };

    const messageText = formatMessage();

    // Check if there's an old participant list message
    const lastListMessage = await this.convex.query(api.queries.getLastListMessage, {
      chatId,
      postId,
    });

    // Delete old message if it exists
    if (lastListMessage) {
      try {
        await this.bot.api.deleteMessage(chatId, lastListMessage.messageId);
      } catch (error) {
        console.error('Failed to delete old message:', error);
        // Continue anyway - old message might already be deleted
      }
    }

    // Send the new message (reply to the post)
    const sentMessage = await this.bot.api.sendMessage(chatId, messageText, {
      reply_to_message_id: postId,
    });

    // Store the new message ID
    await this.convex.mutation(api.mutations.setLastListMessage, {
      chatId,
      postId,
      messageId: sentMessage.message_id,
    });

    // Mark task as completed
    await this.convex.mutation(api.mutations.updateBotTask, {
      taskId: task._id,
      status: "completed",
      resultMessageId: sentMessage.message_id,
    });

    console.log(`✅ Sent participant list message ${sentMessage.message_id}`);
  }
}
