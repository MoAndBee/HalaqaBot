import type { Api } from "grammy";
import type { User, StorageService } from "@halakabot/db";

export class UserListService {
  constructor(private storage: StorageService) {}

  async addUserIfNew(chatId: number, postId: number, user: User): Promise<boolean> {
    return await this.storage.addUserToList(chatId, postId, user);
  }

  async getUserList(chatId: number, postId: number): Promise<User[]> {
    return await this.storage.getUserList(chatId, postId);
  }

  clearList(chatId: number, postId: number): void {
    this.storage.clearUserList(chatId, postId);
    this.storage.clearLastListMessage(chatId, postId);
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
    api: Api
  ): Promise<boolean> {
    // Normalize to array
    const userArray = Array.isArray(users) ? users : [users];

    // Add users and track if list changed
    let listChanged = false;
    for (const user of userArray) {
      const changed = await this.addUserIfNew(chatId, postId, user);
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
      const previousMessageId = await this.storage.getLastListMessage(chatId, postId);
      if (previousMessageId) {
        try {
          await api.deleteMessage(chatId, previousMessageId);
          console.log("Deleted previous list message");
        } catch (error) {
          console.log("Could not delete previous list message:", error);
        }
      }

      // Send new list message as a comment on the post
      const userList = await this.getUserList(chatId, postId);
      const listMessage = this.formatUserList(userList);

      const sentMessage = await api.sendMessage(
        chatId,
        `📋 القائمة:\n\n${listMessage}`,
        { reply_to_message_id: postId }
      );

      // Store the new message ID for future deletion
      this.storage.setLastListMessage(chatId, postId, sentMessage.message_id);
    }

    return listChanged;
  }
}
