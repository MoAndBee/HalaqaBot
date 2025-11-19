export interface User {
  entryId?: string; // Convex _id for this specific list entry (allows duplicate users)
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
