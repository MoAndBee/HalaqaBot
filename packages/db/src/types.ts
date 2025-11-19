export interface User {
  id: number;
  telegramName: string;
  realName?: string | null;
  username?: string | null;
  position?: number;
  carriedOver?: boolean;
  sessionType?: string;
  sessionNumber?: number;
}

export interface ChatStorage {
  chatId: number;
  lastListMessageId: number | null;
}
