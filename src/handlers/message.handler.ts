import type { Bot, Context } from "grammy";
import type { MessageService } from "../services/message.service";

export function registerMessageHandler(
  bot: Bot,
  messageService: MessageService,
) {
  bot.on("message", async (ctx: Context) => {
    console.log("New message received:");
    console.log("=>", {
      message_id: ctx.message!.message_id,
      chat: {
        id: ctx.chat!.id,
        type: ctx.chat!.type,
        title: ctx.chat!.type !== "private" ? (ctx.chat as any).title : undefined,
      },
      from: {
        id: ctx.from!.id,
        first_name: ctx.from!.first_name,
        username: ctx.from!.username,
      },
      date: new Date(ctx.message!.date * 1000).toISOString(),
      text: (ctx.message as any).text,
      caption: (ctx.message as any).caption,
    });

    // Store the message author for later reference
    messageService.storeMessageAuthor(
      ctx.chat!.id,
      ctx.message!.message_id,
      {
        id: ctx.from!.id,
        first_name: ctx.from!.first_name,
        username: ctx.from!.username,
      },
    );
  });
}
