import type { Bot, Context } from "grammy";
import type { MessageService } from "../services/message.service";
import type { StorageService } from "@halakabot/db";

export function registerMessageHandler(
  bot: Bot,
  messageService: MessageService,
  storage: StorageService,
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
        username: ctx.from.username,
      } : undefined,
      date: new Date(ctx.message!.date * 1000).toISOString(),
      text: message.text,
      caption: message.caption,
    });

    // Store the message author and text for later reference
    const messageText = message.text || message.caption;
    messageService.storeMessageAuthor(
      ctx.chat!.id,
      postId,
      ctx.message!.message_id,
      {
        id: ctx.from!.id,
        first_name: ctx.from!.first_name,
        username: ctx.from!.username,
      },
      messageText,
    );
  });
}
