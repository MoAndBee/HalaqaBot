import type { Bot, Context } from "grammy";
import type { ClassificationService } from "../services/classification.service";
import type { ConvexClient } from "@halakabot/db";
import type { MessageService } from "../services/message.service";
import type { UserListService } from "../services/user-list.service";
import type { Config } from "../config/environment";
import { api } from "@halakabot/db";

export function registerAutoClassifyHandler(
  bot: Bot,
  classificationService: ClassificationService,
  messageService: MessageService,
  userListService: UserListService,
  convex: ConvexClient,
  config: Config,
) {
  bot.command("auto", async (ctx: Context) => {
    console.log("Auto-classify command received");

    // Get chat and post context from the command
    const chatId = ctx.chat!.id;

    // Try to get the post ID from the replied message or from the database
    let postId: number | null = null;

    if (ctx.message?.reply_to_message) {
      const replyToMessageId = ctx.message.reply_to_message.message_id;
      // Check if it's an automatic forward (i.e., a post)
      if (ctx.message.reply_to_message.is_automatic_forward) {
        postId = replyToMessageId;
      } else {
        // Try to find the post ID from database
        postId = await convex.query(api.queries.getPostIdForMessage, {
          chatId,
          messageId: replyToMessageId,
        });
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
      .filter((msg) => msg.text && msg.text.trim().length > 0)
      .map((msg) => ({
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
        containsName: classification.containsName,
        detectedNames: classification.names || [],
      });

      // React to messages with names
      if (classification.containsName) {
        totalWithNames++;
        messageIdsWithNames.push(messageId);

        // Store first detected name for this message
        if (classification.names && classification.names.length > 0) {
          messageIdToName.set(messageId, classification.names[0]);
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
      const userIdToDisplayName = new Map<number, string>();

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
            userIdToDisplayName.set(author.id, detectedName);
          }
        }
      }

      if (authors.length > 0) {
        await userListService.updateUserListInChat(
          chatId,
          postId,
          authors,
          ctx.api,
          userIdToDisplayName
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
