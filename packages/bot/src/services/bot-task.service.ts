import type { Bot } from "grammy";
import { ConvexClient, ConvexHttpClient, api } from "@halakabot/db";

export class BotTaskService {
  private bot: Bot;
  private convex: ConvexHttpClient;
  private reactiveClient: ConvexClient;
  private isProcessing = false;
  private unsubscribe: (() => void) | null = null;

  constructor(bot: Bot, convex: ConvexHttpClient, reactiveClient: ConvexClient) {
    this.bot = bot;
    this.convex = convex;
    this.reactiveClient = reactiveClient;
  }

  /**
   * Start watching for pending bot tasks and process them reactively
   */
  start() {
    console.log("Bot task service started, subscribing to pending tasks...");

    // Subscribe to pending tasks - Convex will push updates when data changes
    this.unsubscribe = this.reactiveClient.onUpdate(
      api.queries.getPendingBotTasks,
      {},
      (tasks) => {
        if (tasks === undefined) return; // Initial loading state
        this.handleTasksUpdate(tasks);
      }
    );
  }

  /**
   * Stop the task service and clean up subscription
   */
  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      console.log("Bot task service stopped");
    }
  }

  private async handleTasksUpdate(tasks: any[]) {
    if (this.isProcessing || tasks.length === 0) return;

    this.isProcessing = true;
    try {
      for (const task of tasks) {
        await this.processTask(task);
      }
    } catch (error) {
      console.error("Error processing bot tasks:", error);
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
      } else if (task.type === "mute_participant") {
        await this.handleMuteParticipant(task);
      } else if (task.type === "unmute_participant") {
        await this.handleUnmuteParticipant(task);
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
    const flower = task.flower || '🌸'; // Default to 🌸 if not specified

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

    // Get channel ID from the first message in this post
    const channelIdResult = await this.convex.query(api.queries.getChannelIdForPost, {
      chatId,
      postId,
    });
    const channelId = channelIdResult || -1002081068866; // Fallback to default channel ID

    // Get supervisor name from database (by looking up the supervisor user ID)
    const supervisorName = channelId
      ? await this.convex.query(api.queries.getSessionSupervisorName, {
          chatId,
          postId,
          sessionNumber,
          channelId,
        })
      : null;

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

      // Create flower border
      const flowerBorder = `ه${flower}`.repeat(7);

      let message = `${flowerBorder}\n`;
      message += `${formattedDate}`;

      if (teacherName) {
        message += `\nالمعلمة: ${teacherName}`;
      }

      if (supervisorName) {
        message += `\nالمشرفة: ${supervisorName}`;
      }

      message += `\nـــــــــــــــــــــــ\n`;

      // Combine: completed first, then active
      const allParticipants = [...completedUsers, ...activeUsers];

      // Format each participant
      allParticipants.forEach((participant: any, index: number) => {
        const arabicNumber = (index + 1).toLocaleString('ar-EG');
        const name = participant.realName || participant.telegramName;
        const isDone = completedUsers.some((u: any) => u.id === participant.id);
        const notesLabel = participant.notes ? ` - ${participant.notes}` : '';
        // Format compensation dates if present
        let activityLabel = '';
        if (participant.compensatingForDates && participant.compensatingForDates.length > 0) {
          const formattedDates = participant.compensatingForDates
            .map((timestamp: number) => {
              const date = new Date(timestamp);
              return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
            })
            .join('، ');
          activityLabel = ` (تعويض: ${formattedDates})`;
        } else if (participant.sessionType === 'تلاوة' || participant.sessionType === 'تسميع') {
          activityLabel = ` (${participant.sessionType})`;
        }
        const skipLabel = !isDone && participant.wasSkipped
          ? ` 🗣️`
          : '';
        const doneIcon = isDone ? ' ✅' : '';
        message += `${arabicNumber}. ${name}${notesLabel}${activityLabel}${skipLabel}${doneIcon}\n`;
      });

      message += flowerBorder;

      return message;
    };

    const messageText = formatMessage();

    // Check if there's an old participant list message
    const lastListMessage = await this.convex.query(api.queries.getLastListMessage, {
      chatId,
      postId,
    });

    // Delete old message only if it's for the same session (halaqa)
    if (lastListMessage && lastListMessage.sessionNumber === sessionNumber) {
      try {
        await this.bot.api.deleteMessage(chatId, lastListMessage.messageId);
        console.log(`Deleted previous message for session ${sessionNumber}`);
      } catch (error) {
        console.error('Failed to delete old message:', error);
        // Continue anyway - old message might already be deleted
      }
    } else if (lastListMessage) {
      console.log(`Keeping previous message (session ${lastListMessage.sessionNumber}) as new message is for different session (${sessionNumber})`);
    }

    // Send the new message (reply to the post)
    const sentMessage = await this.bot.api.sendMessage(chatId, messageText, {
      reply_to_message_id: postId,
    });

    // Store the new message ID with session number
    await this.convex.mutation(api.mutations.setLastListMessage, {
      chatId,
      postId,
      messageId: sentMessage.message_id,
      sessionNumber,
    });

    // Mark task as completed
    await this.convex.mutation(api.mutations.updateBotTask, {
      taskId: task._id,
      status: "completed",
      resultMessageId: sentMessage.message_id,
    });

    console.log(`✅ Sent participant list message ${sentMessage.message_id}`);
  }

  private async handleMuteParticipant(task: any) {
    const { chatId, targetUserId } = task;

    if (!targetUserId) {
      throw new Error("mute_participant task missing targetUserId");
    }

    await this.bot.api.restrictChatMember(chatId, targetUserId, {
      permissions: {
        can_send_messages: false,
        can_send_audios: false,
        can_send_documents: false,
        can_send_photos: false,
        can_send_videos: false,
        can_send_video_notes: false,
        can_send_voice_notes: false,
        can_send_polls: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
      },
    });

    await this.convex.mutation(api.mutations.updateBotTask, {
      taskId: task._id,
      status: "completed",
    });

    console.log(`✅ Muted participant ${targetUserId} in chat ${chatId}`);
  }

  private async handleUnmuteParticipant(task: any) {
    const { chatId, targetUserId } = task;

    if (!targetUserId) {
      throw new Error("unmute_participant task missing targetUserId");
    }

    await this.bot.api.restrictChatMember(chatId, targetUserId, {
      permissions: {
        can_send_messages: true,
        can_send_audios: true,
        can_send_documents: true,
        can_send_photos: true,
        can_send_videos: true,
        can_send_video_notes: true,
        can_send_voice_notes: true,
        can_send_polls: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
        can_change_info: false,
        can_invite_users: true,
        can_pin_messages: false,
      },
    });

    await this.convex.mutation(api.mutations.updateBotTask, {
      taskId: task._id,
      status: "completed",
    });

    console.log(`✅ Unmuted participant ${targetUserId} in chat ${chatId}`);
  }
}
