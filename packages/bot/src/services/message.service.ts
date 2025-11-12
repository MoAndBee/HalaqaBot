import type { Api } from "grammy";
import type { User, ConvexHttpClient } from "@halakabot/db";
import { api } from "@halakabot/db";

export class MessageService {
  constructor(
    private convex: ConvexHttpClient,
    private forwardChatId: string,
  ) {}

  async getMessageAuthor(
    gmyApi: Api,
    chatId: number,
    postId: number,
    messageId: number,
  ): Promise<User | null> {
    // Try to get from storage first
    let messageAuthor = await this.convex.query(api.queries.getMessageAuthor, {
      chatId,
      postId,
      messageId,
    });

    if (messageAuthor) {
      return messageAuthor;
    }

    // If not in storage, try to forward the message to get the author
    console.log(
      `Message author not in storage. Attempting to forward message ${messageId}...`,
    );

    try {
      const forwardedMessage = await gmyApi.forwardMessage(
        this.forwardChatId,
        chatId,
        messageId,
      );

      console.log("Forwarded message:", forwardedMessage);

      // Extract author from forwarded message
      if (forwardedMessage.forward_origin) {
        const origin = forwardedMessage.forward_origin;

        if (origin.type === "user") {
          messageAuthor = {
            id: origin.sender_user.id,
            first_name: origin.sender_user.first_name,
            username: origin.sender_user.username,
          };
          console.log("Found message author from forward:", messageAuthor);

          // Store it for future use
          await this.convex.mutation(api.mutations.addMessageAuthor, {
            chatId,
            postId,
            messageId,
            user: messageAuthor,
          });
        } else if (origin.type === "hidden_user") {
          console.log(
            "⚠️  Message author has privacy settings enabled (hidden user)",
          );
          messageAuthor = {
            id: 0,
            first_name: origin.sender_user_name,
            username: undefined,
          };
        } else {
          console.log(
            `⚠️  Message is from a ${origin.type}, not a regular user`,
          );
        }
      }
    } catch (error) {
      console.error("Error forwarding message:", error);
      console.log(
        "⚠️  Could not retrieve message. It may have been deleted or bot lacks permissions.",
      );
    }

    return messageAuthor;
  }

  async storeMessageAuthor(chatId: number, postId: number, messageId: number, user: User, messageText?: string, channelId?: number): Promise<void> {
    await this.convex.mutation(api.mutations.addMessageAuthor, {
      chatId,
      postId,
      messageId,
      user,
      messageText,
      channelId,
    });
  }
}
