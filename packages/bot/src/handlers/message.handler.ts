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

    // Walk up the reply chain to find the original channel post
    let postId: number | null = null;
    let channelId: number | undefined = undefined;
    let messageType = "unknown";

    // Case 1: This message itself is an automatic forward (it's the channel post)
    if (message.is_automatic_forward) {
      postId = message.message_id;
      channelId = message.sender_chat?.id;
      messageType = "channel post";
    }
    // Case 2: This is a direct reply to an automatic forward (comment on post)
    else if (message.reply_to_message?.is_automatic_forward) {
      postId = message.reply_to_message.message_id;
      channelId = message.reply_to_message.sender_chat?.id;
      messageType = "comment on post";
    }
    // Case 3: This might be a nested reply (comment on comment)
    else if (message.reply_to_message) {
      // Query the database to find which thread the parent message belongs to
      const parentPostInfo = await convex.query(api.queries.getPostIdForMessage, {
        chatId: ctx.chat!.id,
        messageId: message.reply_to_message.message_id,
      });

      if (parentPostInfo) {
        postId = parentPostInfo.postId;
        channelId = parentPostInfo.channelId ?? undefined;
        messageType = "nested comment";
      }
    }

    // If we couldn't find a post in the chain, skip this message
    if (postId === null) {
      console.log("⏭️  Message is not part of a channel post thread - skipping");
      return "Message is not part of a channel post thread";
    }

    console.log({isAutomaticForward: message.is_automatic_forward, postId, messageType});

    console.log(`New message received: [${messageType.toUpperCase()}]`);
    console.log("=>", {
      message_id: ctx.message!.message_id,
      post_id: postId,
      message_type: messageType,
      is_automatic_forward: message.is_automatic_forward,
      is_reply: !!message.reply_to_message,
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

    // Automatically classify message to detect activity type ONLY
    // Never auto-detect names from messages - only detect names from admin 👌 reactions
    if (messageText && messageText.trim().length > 0 && ctx.from) {
      console.log(`\n🔍 Auto-classification (activity type only) for user ${ctx.from.id}...`);
      console.log(`   Message text: "${messageText}"`);

      try {
        // Always use activity-type-only classification
        // Name detection happens only through admin reactions (authoritative)
        const classifications = await classificationService.classifyActivityTypeOnly([{
          id: ctx.message!.message_id,
          text: messageText,
        }]);

        const classification = classifications.get(ctx.message!.message_id);

        console.log(`   Classification result:`, {
          containsName: classification?.containsName,
          detectedNames: classification?.detectedNames,
          activityType: classification?.activityType,
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
            activityType: classification.activityType ?? undefined,
            channelId: channelId,
          });

          if (classification.containsName && classification.detectedNames && classification.detectedNames.length > 0) {
            console.log(`✅ Detected name in message: ${classification.detectedNames.join(' ')}`);
            console.log(`   Stored classification and updated user realName via storeClassification mutation`);
          } else if (classification.activityType) {
            console.log(`✅ Detected activity type: ${classification.activityType}`);
          } else {
            console.log(`   ℹ️  No names or activity type detected in message`);
          }
        }
      } catch (error) {
        console.error("❌ Error during automatic classification:", error);
      }
    } else {
      if (!messageText || messageText.trim().length === 0) {
        console.log(`⏭️  Skipping classification - no message text`);
      }
    }
  });
}
