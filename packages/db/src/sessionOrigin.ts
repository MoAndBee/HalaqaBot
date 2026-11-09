/**
 * Halaqas held outside Telegram (Zoom, Meet, …) are added to a post as extra
 * sessions from a pasted manual list. They can run at the same time as the
 * post's Telegram halaqa, so anything that means "the halaqa in progress on
 * Telegram" — where a new registration goes, which session a new one follows,
 * which list the bot posts — must skip them.
 */

export const EXTERNAL_SESSION_ORIGIN = "external";

export function isExternalSession(session: { origin?: string | null }): boolean {
  return session.origin === EXTERNAL_SESSION_ORIGIN;
}

/** Newest first, by creation time with the session number as tiebreaker */
export function compareSessionsNewestFirst(
  a: { createdAt: number; sessionNumber: number },
  b: { createdAt: number; sessionNumber: number }
): number {
  if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
  return b.sessionNumber - a.sessionNumber;
}

/**
 * The post's current Telegram session: the newest one that isn't external.
 * Undefined when the post has none yet — callers fall back to session 1,
 * which is where a post's turns live before its first session is started.
 */
export function pickCurrentSession<
  T extends { createdAt: number; sessionNumber: number; origin?: string | null },
>(sessions: T[]): T | undefined {
  return [...sessions].sort(compareSessionsNewestFirst).find((s) => !isExternalSession(s));
}
