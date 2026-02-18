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
  isCompensation?: boolean; // true if this turn/participation is for compensation
  compensatingForDates?: number[]; // array of timestamps for dates being compensated
  wasSkipped?: boolean; // true if this participant has been skipped
  isMuted?: boolean; // true if this participant has been muted by an admin
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
