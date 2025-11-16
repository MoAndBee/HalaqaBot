export interface User {
  id: number;
  telegramName: string;
  realName?: string | null;
  username?: string | null;
  position?: number;
  carriedOver?: boolean;
  sessionType?: string;
}

export interface ChatStorage {
  chatId: number;
  lastListMessageId: number | null;
}
