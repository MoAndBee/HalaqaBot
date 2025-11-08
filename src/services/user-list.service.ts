import type { User } from "../types";
import type { StorageService } from "./storage.service";

export class UserListService {
  constructor(private storage: StorageService) {}

  addUserIfNew(chatId: number, user: User): boolean {
    return this.storage.addUserToList(chatId, user);
  }

  getUserList(chatId: number): User[] {
    return this.storage.getUserList(chatId);
  }

  clearList(chatId: number): void {
    this.storage.clearUserList(chatId);
    this.storage.clearLastListMessage(chatId);
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

  printUserListToConsole(chatId: number): void {
    const userList = this.getUserList(chatId);
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
