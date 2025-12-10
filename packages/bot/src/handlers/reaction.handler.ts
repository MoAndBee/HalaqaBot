import type { Bot, Context } from "grammy";
import type { MessageService } from "../services/message.service";
import type { UserListService } from "../services/user-list.service";
import type { ClassificationService } from "../services/classification.service";
import type { ConvexHttpClient } from "@halakabot/db";
import { api } from "@halakabot/db";
import type { Config } from "../config/environment";

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

    // Check if the new reaction contains heart or thumbs up emoji
    const newReaction = ctx.messageReaction!.new_reaction;
    const hasHeartOrThumbsUp = newReaction.some((reaction) => {
      if (reaction.type === "emoji") {
        return reaction.emoji === "❤" || reaction.emoji === "👍";
      }
      return false;
    });

    if (hasHeartOrThumbsUp) {
      const messageId = ctx.messageReaction!.message_id;

      // Try to find the post ID and channel ID from the database
      const result = await convex.query(api.queries.getPostIdForMessage, {
        chatId,
        messageId,
      });

      // If message not in database, ignore the reaction
      if (!result) {
        console.log(`⚠️  Message ${messageId} not found in database, ignoring reaction`);
        return;
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

      // Check if user is in the allowed whitelist
      if (!config.allowedReactionUserIds.includes(userId)) {
        console.log(`⚠️  User ${userId} is not in the allowed reaction whitelist, ignoring reaction`);
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
        // Try to get classification for this message
        let classification = await convex.query(api.queries.getClassification, {
          chatId,
          postId,
          messageId,
        });

        // If not classified yet, try to classify it now
        if (!classification) {
          // Get the message text from the database
          const messageText = await convex.query(api.queries.getMessageText, {
            chatId,
            postId,
            messageId,
          });

          if (messageText && messageText.trim().length > 0) {
            // Classify the message
            const classifications = await classificationService.classifyBatch([
              { id: messageId, text: messageText }
            ]);

            const result = classifications.get(messageId);
            if (result) {
              // Store the classification
              await convex.mutation(api.mutations.storeClassification, {
                chatId,
                postId,
                messageId,
                messageText: messageText,
                containsName: result.containsName,
                detectedNames: result.detectedNames || [],
                activityType: result.activityType ?? undefined,
                channelId,
              });

              classification = {
                containsName: result.containsName,
                detectedNames: result.detectedNames || [],
                activityType: result.activityType,
              };
            }
          }
        }

        // Log classification result for debugging
        console.log('Classification result:', {
          containsName: classification?.containsName,
          detectedNames: classification?.detectedNames,
          activityType: classification?.activityType,
        });

        // Extract real name if available (join all detected names)
        let realName: string | undefined;
        if (classification?.detectedNames && classification.detectedNames.length > 0) {
          realName = classification.detectedNames.join(' ');
        }

        // Only register the student if a name was detected
        if (!classification?.containsName || !realName) {
          console.log(`⚠️  Message does not contain a student name, ignoring reaction`);
          console.log(`   - containsName: ${classification?.containsName}`);
          console.log(`   - realName: ${realName}`);
          console.log(`   - detectedNames: ${JSON.stringify(classification?.detectedNames)}`);
          return;
        }

        // Extract activity type from this message
        let activityType = classification?.activityType;

        // If no activity type in this message, look for latest from ANY message by this user
        if (!activityType) {
          activityType = await convex.query(api.queries.getLatestActivityTypeForUser, {
            chatId,
            postId,
            userId: messageAuthor.id,
          });
        }

        // Create userIdToRealName map if we have a real name
        const userIdToRealName = realName
          ? new Map([[messageAuthor.id, realName]])
          : undefined;

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
