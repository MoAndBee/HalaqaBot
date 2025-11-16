import type { Bot, Context } from "grammy";
import type { ClassificationService } from "../services/classification.service";
import type { ConvexHttpClient } from "@halakabot/db";
import type { MessageService } from "../services/message.service";
import type { UserListService } from "../services/user-list.service";
import type { Config } from "../config/environment";
import { api } from "@halakabot/db";

export function registerAutoClassifyHandler(
  bot: Bot,
  classificationService: ClassificationService,
  messageService: MessageService,
  userListService: UserListService,
  convex: ConvexHttpClient,
  config: Config,
) {
  bot.command("auto", async (ctx: Context) => {
    console.log("Auto-classify command received");

    // Delete the command message ASAP
    try {
      await ctx.deleteMessage();
      console.log("Command message deleted");
    } catch (error) {
      console.error("Failed to delete command message:", error);
    }

    // Get chat and post context from the command
    const chatId = ctx.chat!.id;

    // Try to get the post ID and channel ID from the replied message or from the database
    let postId: number | null = null;
    let channelId: number | null = null;

    if (ctx.message?.reply_to_message) {
      const replyToMessageId = ctx.message.reply_to_message.message_id;
      // Check if it's an automatic forward (i.e., a post)
      if (ctx.message.reply_to_message.is_automatic_forward) {
        postId = replyToMessageId;
        channelId = ctx.message.reply_to_message.sender_chat?.id ?? null;
      } else {
        // Try to find the post ID and channel ID from database
        const result = await convex.query(api.queries.getPostIdForMessage, {
          chatId,
          messageId: replyToMessageId,
        });
        if (result) {
          postId = result.postId;
          channelId = result.channelId;
        }
      }
    }

    if (!postId) {
      await ctx.reply("⚠️ Please reply to a channel post to run auto-classification");
      return;
    }

    // Get unclassified messages for this post
    const unclassifiedMessages = await convex.query(api.queries.getUnclassifiedMessages, {
      chatId,
      postId,
    });

    if (unclassifiedMessages.length === 0) {
      await ctx.reply("✅ No unclassified messages found for this post");
      return;
    }

    await ctx.reply(`🤖 Found ${unclassifiedMessages.length} unclassified messages. Processing...`);

    // Prepare messages for batch classification
    const messagesToClassify = unclassifiedMessages
      .filter((msg: { text?: string; messageId: number }) => msg.text && msg.text.trim().length > 0)
      .map((msg: { text: string; messageId: number }) => ({
        id: msg.messageId,
        text: msg.text,
      }));

    if (messagesToClassify.length === 0) {
      await ctx.reply("⚠️ No messages with text found to classify");
      return;
    }

    console.log(`Classifying ${messagesToClassify.length} messages in batch...`);

    // Perform batch classification
    const classifications = await classificationService.classifyBatch(messagesToClassify);

    // Create a map of messageId to messageText for easy lookup
    const messageTextMap = new Map(messagesToClassify.map(msg => [msg.id, msg.text]));

    let reactedCount = 0;
    let totalWithNames = 0;
    const messageIdsWithNames: number[] = [];
    const messageIdToName = new Map<number, string>();

    // Process results
    for (const [messageId, classification] of classifications) {
      // Store classification
      await convex.mutation(api.mutations.storeClassification, {
        chatId,
        postId,
        messageId,
        messageText: messageTextMap.get(messageId),
        containsName: classification.containsName,
        detectedNames: classification.detectedNames || [],
        channelId: channelId ?? undefined,
      });

      // React to messages with names
      if (classification.containsName) {
        totalWithNames++;
        messageIdsWithNames.push(messageId);

        // Store all detected names joined together for this message
        if (classification.detectedNames && classification.detectedNames.length > 0) {
          const fullName = classification.detectedNames.join(' ');
          if (fullName) {
            messageIdToName.set(messageId, fullName);
          }
        }

        try {
          await ctx.api.setMessageReaction(
            chatId,
            messageId,
            [{ type: "emoji", emoji: config.autoReactionEmoji }]
          );
          reactedCount++;
          console.log(`Reacted to message ${messageId}`);
        } catch (error) {
          console.error(`Failed to react to message ${messageId}:`, error);
        }
      }
    }

    // Update user list with authors of messages containing names
    if (messageIdsWithNames.length > 0) {
      console.log(`\nFetching authors for ${messageIdsWithNames.length} messages with names...`);
      const authors = [];
      const userIdToRealName = new Map<number, string>();

      for (const messageId of messageIdsWithNames) {
        const author = await messageService.getMessageAuthor(
          ctx.api,
          chatId,
          postId,
          messageId
        );
        if (author) {
          authors.push(author);
          // Map author ID to detected name if available
          const detectedName = messageIdToName.get(messageId);
          if (detectedName) {
            userIdToRealName.set(author.id, detectedName);
          }
        }
      }

      if (authors.length > 0) {
        await userListService.updateUserListInChat(
          chatId,
          postId,
          authors,
          ctx.api,
          userIdToRealName,
          channelId ?? undefined
        );
      }
    }

    await ctx.reply(
      `✅ Batch classification complete!\n\n` +
      `📊 Processed: ${messagesToClassify.length} messages\n` +
      `📝 Found names in: ${totalWithNames} messages\n` +
      `❤️ Reacted to: ${reactedCount} messages`
    );

    console.log("Auto-classification completed:", {
      processed: messagesToClassify.length,
      withNames: totalWithNames,
      reacted: reactedCount,
    });
  });
}
