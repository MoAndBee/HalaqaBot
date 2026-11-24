import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireChatAccess, requireStudentAccess } from "./auth";

// Exams that admins marked as held over several days, and the inputs the
// student calendar needs to compute نسبة الغياب. The rules live in
// packages/web/src/lib/absence.ts and docs/absence-rate.md.

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function cleanDays(days: string[]): string[] {
  const unique = [...new Set(days)].sort();
  if (unique.length === 0) throw new ConvexError("اختاري يوماً واحداً على الأقل");
  for (const d of unique) {
    if (!DAY_KEY.test(d)) throw new ConvexError(`تاريخ غير صالح: ${d}`);
  }
  return unique;
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new ConvexError("اكتبي اسم الاختبار");
  if (trimmed.length > 100) throw new ConvexError("اسم الاختبار طويل جداً");
  return trimmed;
}

export const getExams = query({
  args: { chatId: v.number() },
  handler: async (ctx, args) => {
    await requireChatAccess(ctx, args.chatId);
    const exams = await ctx.db
      .query("exams")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
    return exams.map((e) => ({ examId: e._id, name: e.name, days: e.days }));
  },
});

/** Create an exam, or replace an existing one's name and days. */
export const saveExam = mutation({
  args: {
    chatId: v.number(),
    examId: v.optional(v.id("exams")),
    name: v.string(),
    days: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireChatAccess(ctx, args.chatId);
    const name = cleanName(args.name);
    const days = cleanDays(args.days);

    const existing = await ctx.db
      .query("exams")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();

    if (args.examId) {
      const own = existing.find((e) => e._id === args.examId);
      if (!own) throw new ConvexError("الاختبار غير موجود");
    }

    // A day belongs to at most one exam
    for (const other of existing) {
      if (other._id === args.examId) continue;
      const clash = other.days.find((d) => days.includes(d));
      if (clash) {
        throw new ConvexError(`يوم ${clash} مضاف بالفعل إلى «${other.name}»`);
      }
    }

    const now = Date.now();
    if (args.examId) {
      await ctx.db.patch(args.examId, { name, days, updatedAt: now });
      return args.examId;
    }
    return await ctx.db.insert("exams", {
      chatId: args.chatId,
      name,
      days,
      createdBy: caller.kind === "user" ? caller.userId : undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deleteExam = mutation({
  args: { chatId: v.number(), examId: v.id("exams") },
  handler: async (ctx, args) => {
    await requireChatAccess(ctx, args.chatId);
    const exam = await ctx.db.get(args.examId);
    if (!exam || exam.chatId !== args.chatId) throw new ConvexError("الاختبار غير موجود");
    await ctx.db.delete(args.examId);
  },
});

/**
 * Course-wide inputs for one student's نسبة الغياب in one month: the times of
 * every اختبار in the course within [from, to) (the client passes its local
 * month and groups them into days, since the server runs in UTC), the marked
 * exams, and when she was removed from the roster.
 */
export const getAbsenceInputs = query({
  args: { userId: v.number(), chatId: v.number(), from: v.number(), to: v.number() },
  handler: async (ctx, args) => {
    // Also checks the admin runs this chat
    await requireStudentAccess(ctx, args.userId, args.chatId);

    const [examRows, exams, rosterRows] = await Promise.all([
      ctx.db
        .query("participationHistory")
        .withIndex("by_chat_type_completed", (q) =>
          q
            .eq("chatId", args.chatId)
            .eq("sessionType", "اختبار")
            .gte("completedAt", args.from)
            .lt("completedAt", args.to)
        )
        .collect(),
      ctx.db
        .query("exams")
        .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
        .collect(),
      ctx.db
        .query("channelStudents")
        .withIndex("by_chat_user", (q) => q.eq("chatId", args.chatId).eq("userId", args.userId))
        .collect(),
    ]);

    const examTimes = examRows.map((e) => e.completedAt);
    const removed = rosterRows.filter((r) => r.removedAt !== undefined).map((r) => r.removedAt!);
    // Removed only if every roster row for her is removed
    const removedAt =
      rosterRows.length > 0 && removed.length === rosterRows.length ? Math.max(...removed) : null;

    return {
      examTimes,
      exams: exams.map((e) => ({ name: e.name, days: e.days })),
      removedAt,
    };
  },
});
