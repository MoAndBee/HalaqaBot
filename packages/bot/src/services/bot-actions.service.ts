import type { Bot, InputFile } from "grammy";
import { api, type ConvexHttpClient, type Id } from "@halakabot/db";
import type { Config } from "../config/environment";
import type { MessageService } from "./message.service";
import type { ClassificationService } from "./classification.service";
import { detectRealNameFromMessage } from "./name-detection.service";
import { PostImportService } from "./post-import.service";
import { UserFacingError } from "../errors";

/**
 * Telegram actions the web app asks the bot to perform (see api.ts). Each one
 * runs to completion within the request, so the caller learns whether it
 * worked; post imports, which can run long, go through the job queue instead.
 */
export class BotActionsService {
  constructor(
    private bot: Bot,
    private convex: ConvexHttpClient,
    private config: Config,
    private messageService: MessageService,
    private classificationService: ClassificationService,
    private registrationClosedPhoto: () => InputFile,
  ) {}

  async reactToMessage(chatId: number, messageId: number) {
    await this.bot.api.setMessageReaction(chatId, messageId, [
      { type: "emoji", emoji: this.config.autoReactionEmoji },
    ]);

    console.log(`✅ Reacted to message ${messageId} in chat ${chatId}`);
  }

  /**
   * Detect the sender's real name from a message and store it. Triggered by the
   * web "add turn" (دور+) flow so adding a participant from a message populates
   * their real name the same way an admin 👌 reaction does. The user has already
   * been added to the queue by the web mutation, so this only resolves the name.
   */
  async detectName(chatId: number, postId: number, messageId: number) {
    // Resolve the message author (from storage, or via forwarding).
    const messageAuthor = await this.messageService.getMessageAuthor(
      this.bot.api,
      chatId,
      postId,
      messageId,
    );

    if (!messageAuthor || messageAuthor.id === 0) {
      console.log(`⏭️  detect_name: no resolvable author for message ${messageId}, skipping`);
      return;
    }

    // Resolve the channel so classification/message records stay channel-consistent.
    const channelId =
      (await this.convex.query(api.queries.getChannelIdForPost, { chatId, postId })) ?? undefined;

    const { realName } = await detectRealNameFromMessage(
      {
        convex: this.convex,
        classificationService: this.classificationService,
        forwardChatId: this.config.forwardChatId,
      },
      this.bot.api,
      chatId,
      postId,
      messageId,
      messageAuthor,
      channelId,
    );

    if (!realName) {
      console.log(`ℹ️  detect_name: no name detected in message ${messageId}, leaving user's name unchanged`);
      return;
    }

    // Don't override a manually-verified name.
    const existingUser = await this.convex.query(api.queries.getUser, { userId: messageAuthor.id });
    if (existingUser?.realName && existingUser?.realNameVerified) {
      console.log(
        `ℹ️  detect_name: user ${messageAuthor.id} already has verified realName "${existingUser.realName}", keeping it`,
      );
      return;
    }

    // Ensure the users row exists, then store the detected name as verified —
    // adding from a message is an explicit admin action, matching 👌 behavior.
    const telegramName = messageAuthor.last_name
      ? `${messageAuthor.first_name} ${messageAuthor.last_name}`
      : messageAuthor.first_name;
    await this.convex.mutation(api.mutations.ensureUser, {
      userId: messageAuthor.id,
      telegramName,
      username: messageAuthor.username,
    });
    await this.convex.mutation(api.mutations.updateUserRealName, {
      userId: messageAuthor.id,
      realName,
    });

    console.log(`✅ detect_name: set realName for user ${messageAuthor.id} to "${realName}"`);
  }

  /**
   * Import an old halaqa post from a link an admin pasted in the web app.
   * Posts published before the bot became a channel admin were never announced
   * to it, so they have to be located through the Telegram API — see
   * PostImportService for how.
   */
  async importPost(importId: Id<"postImports">) {
    const importRecord = await this.convex.query(api.queries.getPostImport, { importId });

    if (!importRecord) {
      throw new Error(`Post import ${importId} not found`);
    }

    // The queue may redeliver a job; skip an import that already ran.
    if (importRecord.status === "completed") {
      return;
    }

    await this.convex.mutation(api.mutations.startPostImport, { importId });

    const importService = new PostImportService(
      this.bot.api,
      this.convex,
      this.config.forwardChatId,
    );
    // Resolution reports its own outcome on the import record, including
    // failures the admin can act on.
    await importService.run(importRecord);
  }

  async deleteMessage(chatId: number, messageId: number) {

    try {
      await this.bot.api.deleteMessage(chatId, messageId);
      console.log(`✅ Deleted message ${messageId} in chat ${chatId}`);
    } catch (error) {
      // Telegram returns an error if the message is already gone — treat as success
      console.error(`Failed to delete message ${messageId} in chat ${chatId}:`, error);
    }
  }

  async sendParticipantList(args: {
    chatId: number;
    postId: number;
    sessionNumber?: number;
    flower?: string;
  }): Promise<{ messageId: number }> {
    const { chatId, postId } = args;
    let { sessionNumber } = args;
    const flower = args.flower || '🌸'; // Default to 🌸 if not specified

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

    // A closed (locked) halaqa is final — don't publish its list again.
    const sessionInfo = await this.convex.query(api.queries.getSessionInfo, {
      chatId,
      postId,
      sessionNumber,
    });
    if (sessionInfo?.isLocked) {
      throw new UserFacingError("لا يمكن إرسال القائمة: الحلقة مغلقة. الرجاء فتح الحلقة أولاً.");
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
      const hijriDate = new Intl.DateTimeFormat('ar-EG-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);

      // Create flower border
      const flowerBorder = `ه${flower}`.repeat(7);

      let message = `${flowerBorder}\n`;
      message += `${hijriDate}\n`;
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
        // Done-ness is a property of the individual turn, not the user. Derive it
        // from the entry's list membership (completed entries come first) so a user
        // with two turns — one done, one still active — doesn't show ✅ on both.
        const isDone = index < completedUsers.length;
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

      // Also delete the old registration-closed image that followed it, if any
      if (lastListMessage.registrationClosedImageMessageId) {
        try {
          await this.bot.api.deleteMessage(chatId, lastListMessage.registrationClosedImageMessageId);
          console.log(`Deleted previous registration-closed image for session ${sessionNumber}`);
        } catch (error) {
          console.error('Failed to delete old registration-closed image:', error);
        }
      }
    } else if (lastListMessage) {
      console.log(`Keeping previous message (session ${lastListMessage.sessionNumber}) as new message is for different session (${sessionNumber})`);
    }

    // Send the new message (reply to the post)
    const sentMessage = await this.bot.api.sendMessage(chatId, messageText, {
      reply_to_message_id: postId,
    });

    // If registration is closed for this session, follow up with the closed-registration image
    let registrationClosedImageMessageId: number | undefined;
    if (currentSession?.registrationClosed) {
      try {
        const photoMessage = await this.bot.api.sendPhoto(chatId, this.registrationClosedPhoto(), {
          reply_to_message_id: postId,
        });
        registrationClosedImageMessageId = photoMessage.message_id;
      } catch (error) {
        console.error("Failed to send registration-closed image:", error);
      }
    }

    // Store the new message ID with session number
    const replaced = await this.convex.mutation(api.mutations.setLastListMessage, {
      chatId,
      postId,
      messageId: sentMessage.message_id,
      sessionNumber,
      registrationClosedImageMessageId,
    });

    // Another send for this session ran alongside this one (two admins at once)
    // and its list landed after we looked: remove it so only one list remains.
    if (
      replaced &&
      replaced.sessionNumber === sessionNumber &&
      replaced.messageId !== lastListMessage?.messageId
    ) {
      for (const messageId of [replaced.messageId, replaced.registrationClosedImageMessageId]) {
        if (messageId === undefined) continue;
        try {
          await this.bot.api.deleteMessage(chatId, messageId);
        } catch (error) {
          console.error('Failed to delete concurrently sent list message:', error);
        }
      }
    }

    console.log(`✅ Sent participant list message ${sentMessage.message_id}`);
    return { messageId: sentMessage.message_id };
  }
}
