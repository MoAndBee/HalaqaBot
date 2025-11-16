import type { Bot, Context } from "grammy";
import type { MessageService } from "../services/message.service";
import type { ClassificationService } from "../services/classification.service";
import type { ConvexHttpClient } from "@halakabot/db";
import { api } from "@halakabot/db";

export function registerMessageHandler(
  bot: Bot,
  messageService: MessageService,
  classificationService: ClassificationService,
  convex: ConvexHttpClient,
) {
  bot.on("message", async (ctx: Context) => {
    const message = ctx.message;
    if(!message) return

    const isAutomaticForward = message.is_automatic_forward || message.reply_to_message?.is_automatic_forward
    console.log({isAutomaticForward})
    if(!isAutomaticForward) return "It is nor a post or comment on a post"

    const isComment = message.reply_to_message?.is_automatic_forward

    // Get the post ID (for comments: original post ID, for posts: own message ID)
    const postId = isComment ? message.reply_to_message!.message_id : message.message_id;

    // Extract channel ID from sender_chat (available for automatic forwards)
    const channelId = isComment
      ? message.reply_to_message!.sender_chat?.id
      : message.sender_chat?.id;

    // Determine message type
    let messageType = isComment?  "comment on post" :"channel post";

    console.log(`New message received: [${messageType.toUpperCase()}]`);
    console.log("=>", {
      message_id: ctx.message!.message_id,
      post_id: postId,
      message_type: messageType,
      is_comment: isComment,
      is_automatic_forward: isAutomaticForward,
      chat: {
        id: ctx.chat!.id,
        type: ctx.chat!.type,
        title: ctx.chat!.type !== "private" ? (ctx.chat as any).title : undefined,
      },
      from: ctx.from ? {
        id: ctx.from.id,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
        username: ctx.from.username,
      } : undefined,
      date: new Date(ctx.message!.date * 1000).toISOString(),
      text: message.text,
      caption: message.caption,
    });

    // Store the message author and text for later reference
    // Skip storing if it's GroupAnonymousBot - we'll get the real author via forwarding later
    const messageText = message.text || message.caption;
    const isAnonymousBot = ctx.from?.username === "GroupAnonymousBot";

    // if (!isAnonymousBot && ctx.from) {
      await messageService.storeMessageAuthor(
        ctx.chat!.id,
        postId,
        ctx.message!.message_id,
        {
          id: ctx!.from!.id,
          first_name: ctx!.from!.first_name,
          last_name: ctx!.from!.last_name,
          username: ctx!.from!.username,
        },
        messageText,
        channelId,
      );
    // } else {
    //   console.log("⚠️  Anonymous admin post detected - will retrieve real author via forwarding when needed");
    // }

    // Automatically classify message to detect names
    // Only classify if message has text and user is not already in users table with a realName
    if (messageText && messageText.trim().length > 0 && ctx.from) {
      console.log(`\n🔍 Checking if auto-classification needed for user ${ctx.from.id}...`);

      // Check if user already has a realName
      const existingUser = await convex.query(api.queries.getUser, {
        userId: ctx.from.id,
      });

      console.log(`   User exists: ${!!existingUser}, Has realName: ${!!existingUser?.realName}`);

      // Only classify if user doesn't have a realName yet
      if (!existingUser?.realName) {
        console.log(`🤖 Auto-classifying message ${ctx.message!.message_id} for user ${ctx.from.id}...`);
        console.log(`   Message text: "${messageText}"`);

        try {
          // Classify the single message
          const classifications = await classificationService.classifyBatch([{
            id: ctx.message!.message_id,
            text: messageText,
          }]);

          const classification = classifications.get(ctx.message!.message_id);

          console.log(`   Classification result:`, {
            containsName: classification?.containsName,
            detectedNames: classification?.detectedNames,
          });

          if (classification) {
            // Store the classification
            await convex.mutation(api.mutations.storeClassification, {
              chatId: ctx.chat!.id,
              postId: postId,
              messageId: ctx.message!.message_id,
              messageText: messageText,
              containsName: classification.containsName,
              detectedNames: classification.detectedNames || [],
              channelId: channelId,
            });

            if (classification.containsName && classification.detectedNames && classification.detectedNames.length > 0) {
              console.log(`✅ Detected name in message: ${classification.detectedNames.join(' ')}`);
              console.log(`   Stored classification and updated user realName via storeClassification mutation`);
            } else {
              console.log(`   ℹ️  No names detected in message`);
            }
          }
        } catch (error) {
          console.error("❌ Error during automatic classification:", error);
        }
      } else {
        console.log(`⏭️  Skipping classification - user ${ctx.from.id} already has realName: ${existingUser.realName}`);
      }
    } else {
      if (!messageText || messageText.trim().length === 0) {
        console.log(`⏭️  Skipping classification - no message text`);
      }
    }
  });
}
