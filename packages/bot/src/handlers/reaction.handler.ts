import type { Bot, Context } from "grammy";
import type { MessageService } from "../services/message.service";
import type { UserListService } from "../services/user-list.service";
import type { ClassificationService } from "../services/classification.service";
import type { ConvexHttpClient } from "@halakabot/db";
import { api } from "@halakabot/db";
import type { Config } from "../config/environment";
import { detectRealNameFromMessage } from "../services/name-detection.service";

export function registerReactionHandler(
  bot: Bot,
  messageService: MessageService,
  userListService: UserListService,
  classificationService: ClassificationService,
  convex: ConvexHttpClient,
  config: Config,
) {
  bot.on("message_reaction", async (ctx: Context) => {
    console.log("Reaction received:");
    console.log({
      chat: {
        id: ctx.messageReaction!.chat.id,
        type: ctx.messageReaction!.chat.type,
      },
      message_id: ctx.messageReaction!.message_id,
      date: new Date(ctx.messageReaction!.date * 1000).toISOString(),
      old_reaction: ctx.messageReaction!.old_reaction,
      new_reaction: ctx.messageReaction!.new_reaction,
    });

    // Get the user who reacted
    const userId = ctx.messageReaction!.user?.id;

    // Return early if anonymous reaction or no user info
    if (!userId) {
      console.log("⚠️  Anonymous reaction detected, ignoring");
      return;
    }

    const chatId = ctx.messageReaction!.chat.id;

    // Check if the OK hand emoji was NEWLY ADDED (not already present)
    const oldReaction = ctx.messageReaction!.old_reaction;
    const newReaction = ctx.messageReaction!.new_reaction;

    const hadOkHandEmoji = oldReaction.some((reaction) => {
      if (reaction.type === "emoji") {
        return reaction.emoji === "👌";
      }
      return false;
    });

    const hasOkHandEmoji = newReaction.some((reaction) => {
      if (reaction.type === "emoji") {
        return reaction.emoji === "👌";
      }
      return false;
    });

    // Only process if 👌 was NEWLY ADDED (not already there)
    if (hasOkHandEmoji && !hadOkHandEmoji) {
      const messageId = ctx.messageReaction!.message_id;

      // Try to find the post ID and channel ID from the database
      // Use retry mechanism to handle race condition with message handler
      let result = await convex.query(api.queries.getPostIdForMessage, {
        chatId,
        messageId,
      });

      // If message not in database, retry a few times with delays
      // This handles the race condition where admin reacts before message is stored
      if (!result) {
        const maxRetries = 3;
        const retryDelays = [500, 1000, 2000]; // ms between retries

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          console.log(`⏳ Message ${messageId} not found in database, retrying in ${retryDelays[attempt]}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));

          result = await convex.query(api.queries.getPostIdForMessage, {
            chatId,
            messageId,
          });

          if (result) {
            console.log(`✅ Message ${messageId} found after ${attempt + 1} retry(ies)`);
            break;
          }
        }

        // If still not found after retries, give up
        if (!result) {
          console.log(`⚠️  Message ${messageId} not found in database after ${maxRetries} retries, ignoring reaction`);
          return;
        }
      }

      const { postId, channelId } = result;

      // If no channel ID found, reject the reaction (strict security)
      if (!channelId) {
        console.log(`⚠️  No channel ID found for post ${postId}, rejecting reaction for security`);
        return;
      }

      // Check if user is admin of the CHANNEL (not the discussion group)
      try {
        const channelMember = await ctx.api.getChatMember(channelId, userId);
        const isChannelAdmin = channelMember.status === "creator" || channelMember.status === "administrator";

        if (!isChannelAdmin) {
          console.log(`⚠️  User ${userId} is not a channel admin, ignoring reaction`);
          return;
        }
      } catch (error) {
        console.error(`❌ Error checking channel admin status for user ${userId}:`, error);
        return;
      }

      // Get the message author (from storage or via forwarding)
      const messageAuthor = await messageService.getMessageAuthor(
        ctx.api,
        chatId,
        postId,
        messageId,
      );

      if (messageAuthor) {
        // Detect the sender's real name from the message. This is the shared
        // routine also used by the web دور+ add flow: it fetches the text and
        // runs FULL classification when the stored classification has no names.
        const { realName, activityType: detectedActivityType } = await detectRealNameFromMessage(
          { convex, classificationService, forwardChatId: config.forwardChatId },
          ctx.api,
          chatId,
          postId,
          messageId,
          messageAuthor,
          channelId,
        );

        // ALWAYS require name detection in the message, even if user has existing realName
        // This prevents adding users when reacting to "thanks", "no sound", etc.
        if (!realName) {
          console.log(`⚠️  No name detected in message ${messageId}, ignoring reaction (message must contain a name)`);
          return;
        }

        // Check if user already has a realName in the database
        const existingUser = await convex.query(api.queries.getUser, {
          userId: messageAuthor.id,
        });

        // Admin reaction is authoritative - always update realName unless it's manually verified
        const userIdToRealName = (existingUser?.realName && existingUser?.realNameVerified)
          ? undefined  // Don't update - user has a verified name
          : new Map([[messageAuthor.id, realName]]);  // Update with detected name

        if (existingUser?.realName && existingUser?.realNameVerified) {
          console.log(`ℹ️  User ${messageAuthor.id} has verified realName: "${existingUser.realName}", keeping verified name`);
        } else if (existingUser?.realName) {
          console.log(`ℹ️  User ${messageAuthor.id} has unverified realName: "${existingUser.realName}", will update with detected name: "${realName}"`);
        } else {
          console.log(`ℹ️  User ${messageAuthor.id} has no realName, will update with detected name: "${realName}"`);
        }

        // Extract activity type from this message
        let activityType = detectedActivityType;

        // If no activity type in this message, look for latest from ANY message by this user
        if (!activityType) {
          activityType = await convex.query(api.queries.getLatestActivityTypeForUser, {
            chatId,
            postId,
            userId: messageAuthor.id,
          });
        }

        // Create userIdToActivityType map if we have an activity type
        const userIdToActivityType = activityType
          ? new Map([[messageAuthor.id, activityType]])
          : undefined;

        // Update the user list in chat
        await userListService.updateUserListInChat(
          chatId,
          postId,
          [messageAuthor],
          ctx.api,
          userIdToRealName,
          channelId,
          userIdToActivityType
        );
      }
    }
  });
}
