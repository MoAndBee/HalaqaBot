import type { User } from "../types";
import type { StorageService } from "./storage.service";

export class UserListService {
  constructor(private storage: StorageService) {}

  addUserIfNew(chatId: number, postId: number, user: User): boolean {
    return this.storage.addUserToList(chatId, postId, user);
  }

  getUserList(chatId: number, postId: number): User[] {
    return this.storage.getUserList(chatId, postId);
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

  printUserListToConsole(chatId: number, postId: number): void {
    const userList = this.getUserList(chatId, postId);
    console.log("\n=== Current List ===");
    userList.forEach((user, index) => {
      const username = user.username ? `@${user.username}` : "";
      console.log(
        `${index + 1}. ${user.first_name} ${username} (ID: ${user.id})`,
      );
    });
    console.log("====================\n");
  }
}
