import type { Api } from "grammy";
import type { User, ConvexHttpClient } from "@halakabot/db";
import { api } from "@halakabot/db";

export class UserListService {
  constructor(private convex: ConvexHttpClient) {}

  async addUserIfNew(chatId: number, postId: number, user: User, displayName?: string): Promise<boolean> {
    return await this.convex.mutation(api.mutations.addUserToList, {
      chatId,
      postId,
      user,
      displayName,
    });
  }

  async getUserList(chatId: number, postId: number): Promise<User[]> {
    const result = await this.convex.query(api.queries.getUserList, {
      chatId,
      postId,
    });
    // Return only active users (not completed ones)
    return result.activeUsers;
  }

  async clearList(chatId: number, postId: number): Promise<void> {
    await this.convex.mutation(api.mutations.clearUserList, { chatId, postId });
    await this.convex.mutation(api.mutations.clearLastListMessage, { chatId, postId });
  }

  formatUserList(users: User[]): string {
    return users
      .map((user, index) => {
        const username = user.username ? `@${user.username}` : "";
        const arabicNumber = (index + 1).toLocaleString('ar-EG');
        return `${arabicNumber}. ${user.first_name} ${username}`;
      })
      .join("\n");
  }

  async printUserListToConsole(chatId: number, postId: number): Promise<void> {
    const userList = await this.getUserList(chatId, postId);
    console.log("\n=== Current List ===");
    userList.forEach((user, index) => {
      const username = user.username ? `@${user.username}` : "";
      console.log(
        `${index + 1}. ${user.first_name} ${username} (ID: ${user.id})`,
      );
    });
    console.log("====================\n");
  }

  async updateUserListInChat(
    chatId: number,
    postId: number,
    users: User | User[],
    grammyApi: Api,
    userIdToDisplayName?: Map<number, string>
  ): Promise<boolean> {
    // Normalize to array
    const userArray = Array.isArray(users) ? users : [users];

    // Add users and track if list changed
    let listChanged = false;
    for (const user of userArray) {
      const displayName = userIdToDisplayName?.get(user.id);
      const changed = await this.addUserIfNew(chatId, postId, user, displayName);
      if (changed) {
        listChanged = true;
      }
    }

    if (listChanged) {
      console.log("\n📝 User(s) added to list!");
    } else {
      console.log("\n📝 User(s) already in list");
    }

    // Print the current list to console
    await this.printUserListToConsole(chatId, postId);

    // Send updated list to the chat if it changed
    if (listChanged) {
      // Delete the previous list message if it exists
      const previousMessageId = await this.convex.query(api.queries.getLastListMessage, {
        chatId,
        postId,
      });
      if (previousMessageId) {
        try {
          await grammyApi.deleteMessage(chatId, previousMessageId);
          console.log("Deleted previous list message");
        } catch (error) {
          console.log("Could not delete previous list message:", error);
        }
      }

      // Send new list message as a comment on the post
      const userList = await this.getUserList(chatId, postId);
      const listMessage = this.formatUserList(userList);

      const sentMessage = await grammyApi.sendMessage(
        chatId,
        `📋 القائمة:\n\n${listMessage}`,
        { reply_to_message_id: postId }
      );

      // Store the new message ID for future deletion
      await this.convex.mutation(api.mutations.setLastListMessage, {
        chatId,
        postId,
        messageId: sentMessage.message_id,
      });
    }

    return listChanged;
  }
}
