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
  notes?: string | null;
}

export interface ChatStorage {
  chatId: number;
  lastListMessageId: number | null;
}

export interface ParticipationSummary {
  sessionsCount: number;
  totalAttendance: number;
  totalParticipations: number;
  participationRate: number;
  byType: Record<string, ParticipationTypeStats>;
}

export interface ParticipationTypeStats {
  count: number;
  nonParticipantCount: number;
}
