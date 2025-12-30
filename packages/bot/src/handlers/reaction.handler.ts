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

    // Check if the new reaction contains OK hand emoji
    const newReaction = ctx.messageReaction!.new_reaction;
    const hasOkHandEmoji = newReaction.some((reaction) => {
      if (reaction.type === "emoji") {
        return reaction.emoji === "👌";
      }
      return false;
    });

    if (hasOkHandEmoji) {
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

        // Get the message text (we'll need it for re-classification if needed)
        let messageText = await convex.query(api.queries.getMessageText, {
          chatId,
          postId,
          messageId,
        });

        console.log(`ℹ️  Message text from database: "${messageText}"`);

        // If message text is missing, try to fetch it from Telegram
        if (!messageText || messageText.trim().length === 0) {
          console.log(`⚠️  Message text missing from database, attempting to fetch from Telegram...`);
          try {
            const forwardedMessage = await ctx.api.forwardMessage(
              config.forwardChatId,
              chatId,
              messageId,
            );

            // Extract text from the forwarded message
            messageText = forwardedMessage.text || forwardedMessage.caption || null;
            console.log(`✅ Fetched message text from Telegram: "${messageText}"`);

            // Update the database with the text
            if (messageText) {
              await convex.mutation(api.mutations.addMessageAuthor, {
                chatId,
                postId,
                messageId,
                user: messageAuthor,
                messageText,
                channelId,
              });
              console.log(`✅ Updated database with message text`);
            }
          } catch (error) {
            console.error(`❌ Error fetching message from Telegram:`, error);
          }
        }

        // If classification exists but has no names detected, re-run FULL classification
        // This happens when activity-type-only classification was used during auto-classification
        const needsFullClassification = classification &&
          (!classification.containsName || !classification.detectedNames || classification.detectedNames.length === 0);

        if (needsFullClassification && messageText && messageText.trim().length > 0) {
          console.log(`ℹ️  Existing classification has no names, re-running FULL classification on reaction...`);

          const classifications = await classificationService.classifyBatch([
            { id: messageId, text: messageText }
          ]);

          const result = classifications.get(messageId);
          console.log(`🔍 Full classification result:`, {
            containsName: result?.containsName,
            detectedNames: result?.detectedNames,
            activityType: result?.activityType,
            rawResponse: result?.rawResponse,
          });

          if (result) {
            // Update the stored classification with detected names
            await convex.mutation(api.mutations.storeClassification, {
              chatId,
              postId,
              messageId,
              messageText: messageText,
              containsName: result.containsName,
              detectedNames: result.detectedNames || [],
              activityType: result.activityType ?? classification.activityType ?? undefined,
              channelId,
            });

            // Update our local classification variable
            classification = {
              containsName: result.containsName,
              detectedNames: result.detectedNames || [],
              activityType: result.activityType ?? classification.activityType,
            };
          }
        }

        // If not classified yet at all, classify it now
        if (!classification && messageText && messageText.trim().length > 0) {
          console.log(`ℹ️  No classification exists, running FULL classification...`);

          const classifications = await classificationService.classifyBatch([
            { id: messageId, text: messageText }
          ]);

          const result = classifications.get(messageId);
          console.log(`🔍 Classification result:`, {
            containsName: result?.containsName,
            detectedNames: result?.detectedNames,
            activityType: result?.activityType,
            rawResponse: result?.rawResponse,
          });

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

        if (!messageText || messageText.trim().length === 0) {
          console.log(`⚠️  Message text is empty or could not be retrieved for message ${messageId}, cannot classify`);
        }

        // Extract real name if available (join all detected names)
        let realName: string | undefined;
        if (classification?.detectedNames && classification.detectedNames.length > 0) {
          realName = classification.detectedNames.join(' ');
        }

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

        // Only update realName if user doesn't already have one (Option 1: keep existing)
        const userIdToRealName = existingUser?.realName
          ? undefined  // Don't update - user already has a name
          : new Map([[messageAuthor.id, realName]]);  // Update with detected name

        if (existingUser?.realName) {
          console.log(`ℹ️  User ${messageAuthor.id} already has realName: "${existingUser.realName}", keeping existing name`);
        } else {
          console.log(`ℹ️  User ${messageAuthor.id} has no realName, will update with detected name: "${realName}"`);
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
