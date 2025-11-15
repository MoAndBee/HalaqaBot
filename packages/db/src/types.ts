export interface User {
  id: number;
  first_name: string;
  username?: string;
  displayName?: string;
  position?: number;
  carriedOver?: boolean;
  sessionType?: string;
}

export interface ChatStorage {
  chatId: number;
  lastListMessageId: number | null;
}
