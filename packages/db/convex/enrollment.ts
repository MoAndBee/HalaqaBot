/**
 * Which students belong to which course (channelStudents). A channel's roster
 * is its active enrollment rows; users stays the one record of the person.
 *
 * Telegram students are enrolled by their first turn in a course. Admins add
 * anyone else from the Students page, and can remove a student from the roster,
 * which hides her and stops admins adding her to halaqas but leaves her halaqa
 * data alone. A removed student who signs up herself through the bot is
 * enrolled again.
 */
import { ConvexError } from "convex/values";
import type { Auth, GenericDatabaseReader, GenericDatabaseWriter } from "convex/server";
import type { DataModel, Doc } from "./_generated/dataModel";
import { getCaller, requireChatAccess, requireStudentAccess, type Caller } from "./auth";

type ReadCtx = { db: GenericDatabaseReader<DataModel> };
type WriteCtx = { db: GenericDatabaseWriter<DataModel> };

export type EnrollmentSource = "activity" | "manual";

/**
 * Fold the Arabic spelling variants that make a literal search miss: hamza
 * forms (أإآ → ا), ة → ه, ى → ي, ؤ/ئ, tatweel and tashkeel, plus case for
 * Latin usernames. Names reach the database however whoever typed them spelled
 * them — hand-registered ones especially — so searching "فاطمه" has to find
 * "فاطمة". Mirrors normalizeArabic in the web app's StudentPickerModal.
 */
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** The name a student is shown by: her real name, else her Telegram name. */
export function studentDisplayName(user: Pick<Doc<"users">, "realName" | "telegramName" | "username" | "userId">): string {
  return user.realName || user.telegramName || (user.username ? `@${user.username}` : `#${user.userId}`);
}

export async function getEnrollment(ctx: ReadCtx, chatId: number, userId: number) {
  return await ctx.db
    .query("channelStudents")
    .withIndex("by_chat_user", (q) => q.eq("chatId", chatId).eq("userId", userId))
    .first();
}

/** Students on this course's roster (not removed). */
export async function activeRosterUserIds(ctx: ReadCtx, chatId: number): Promise<Set<number>> {
  const rows = await ctx.db
    .query("channelStudents")
    .withIndex("by_chat", (q) => q.eq("chatId", chatId))
    .collect();
  return new Set(rows.filter((r) => r.removedAt === undefined).map((r) => r.userId));
}

/**
 * Put a student on this course's roster, or back on it if she was removed.
 * Callers decide whether she may be (see requireAddableStudent).
 */
export async function enrollStudent(
  ctx: WriteCtx,
  chatId: number,
  userId: number,
  source: EnrollmentSource,
  addedBy?: number,
): Promise<void> {
  const existing = await getEnrollment(ctx, chatId, userId);
  if (!existing) {
    await ctx.db.insert("channelStudents", { chatId, userId, source, addedBy, addedAt: Date.now() });
  } else if (existing.removedAt !== undefined) {
    await ctx.db.patch(existing._id, { removedAt: undefined });
  }
}

export const REMOVED_STUDENT_ERROR =
  "هذه الطالبة محذوفة من قائمة طالبات الدورة، أعيدي إضافتها من صفحة الطالبات أولاً";

/**
 * May the caller put this student into a halaqa of chatId? The bot may: it
 * only does so when the student signs up herself, which enrolls her again even
 * if she was removed. An admin may not add a removed student.
 *
 * A student with no enrollment row yet falls back to the older evidence (a
 * turn, a message or a home chat here), so nothing breaks before the backfill.
 */
export async function requireAddableStudent(
  ctx: ReadCtx & { auth: Auth },
  userId: number,
  chatId: number,
): Promise<Caller> {
  const caller = await getCaller(ctx);
  if (caller.kind === "bot") return caller;
  await requireChatAccess(ctx, chatId);
  const enrollment = await getEnrollment(ctx, chatId, userId);
  if (enrollment?.removedAt !== undefined) throw new ConvexError(REMOVED_STUDENT_ERROR);
  if (enrollment) return caller;
  return await requireStudentAccess(ctx, userId, chatId);
}

/**
 * Which students an admin may search when adding one to a course: everyone,
 * while there is one organization. When organizations arrive, narrow this to
 * students enrolled in the caller's organization's channels; callers stay as
 * they are. Returns null for "no restriction".
 */
export async function searchableStudentIds(_ctx: ReadCtx, _caller: Caller): Promise<Set<number> | null> {
  return null;
}
