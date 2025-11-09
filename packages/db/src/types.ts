export interface User {
  id: number;
  first_name: string;
  username?: string;
}

export interface ChatStorage {
  chatId: number;
  lastListMessageId: number | null;
}
