import type { Bot, Context } from "grammy";
import type { MessageService } from "../services/message.service";
import type { UserListService } from "../services/user-list.service";
import type { StorageService } from "@halakabot/db";

export function registerReactionHandler(
  bot: Bot,
  messageService: MessageService,
  userListService: UserListService,
  storage: StorageService,
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

    // Check if the new reaction contains heart or thumbs up emoji
    const newReaction = ctx.messageReaction!.new_reaction;
    const hasHeartOrThumbsUp = newReaction.some((reaction) => {
      if (reaction.type === "emoji") {
        return reaction.emoji === "❤" || reaction.emoji === "👍";
      }
      return false;
    });

    if (hasHeartOrThumbsUp) {
      const chatId = ctx.messageReaction!.chat.id;
      const messageId = ctx.messageReaction!.message_id;

      // Try to find the post ID from the database
      const postId = await storage.getPostIdForMessage(chatId, messageId);

      // If message not in database, ignore the reaction
      if (!postId) {
        console.log(`⚠️  Message ${messageId} not found in database, ignoring reaction`);
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
        // Update the user list in chat
        await userListService.updateUserListInChat(
          chatId,
          postId,
          messageAuthor,
          ctx.api
        );
      }
    }
  });
}
