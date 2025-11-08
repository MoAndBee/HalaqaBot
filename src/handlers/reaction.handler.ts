import type { Bot, Context } from "grammy";
import type { MessageService } from "../services/message.service";
import type { UserListService } from "../services/user-list.service";
import type { StorageService } from "../services/storage.service";

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
      const postId = storage.getPostIdForMessage(chatId, messageId);

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
        // Add user to list and check if it changed
        const listChanged = userListService.addUserIfNew(chatId, postId, messageAuthor);

        if (listChanged) {
          console.log("\n📝 User added to list!");
        } else {
          console.log("\n📝 User already in list");
        }

        // Print the current list to console
        userListService.printUserListToConsole(chatId, postId);

        // Send updated list to the chat if it changed
        if (listChanged) {
          // Delete the previous list message if it exists
          const previousMessageId = storage.getLastListMessage(chatId, postId);
          if (previousMessageId) {
            try {
              await ctx.api.deleteMessage(chatId, previousMessageId);
              console.log("Deleted previous list message");
            } catch (error) {
              console.log("Could not delete previous list message:", error);
            }
          }

          // Send new list message
          const userList = userListService.getUserList(chatId, postId);
          const listMessage = userListService.formatUserList(userList);

          const sentMessage = await ctx.api.sendMessage(
            chatId,
            `📋 القائمة:\n\n${listMessage}`,
          );

          // Store the new message ID for future deletion
          storage.setLastListMessage(chatId, postId, sentMessage.message_id);
        }
      }
    }
  });
}
