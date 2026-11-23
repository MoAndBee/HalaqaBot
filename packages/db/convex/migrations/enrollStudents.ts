import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { normalizeName, studentDisplayName } from "../enrollment";

/**
 * One-time fill of channelStudents from what the roster used to be inferred
 * from: anyone with a turn (queued or completed) in a course, plus anyone hand-
 * registered into it (users.homeChatId). Idempotent: rerunning adds only what
 * is missing.
 *
 * Run once after deploy, after migrations/mergeManualStudent:
 *   bunx convex run migrations/enrollStudents:run
 * then check the result:
 *   bunx convex run migrations/enrollStudents:report
 */

// Courses that ended and are left out of the roster on purpose.
// -1003233862716: "دورة أصحاب سورة البقرة" (history 2025-12-31 to 2026-07-11).
const ENDED_COURSE_CHAT_IDS = new Set([-1003233862716]);

const PAGE_SIZE = 500;

export const backfillPage = internalMutation({
  args: {
    table: v.union(v.literal("participationHistory"), v.literal("turnQueue"), v.literal("users")),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({ inserted: v.number(), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.query(args.table).paginate({ numItems: PAGE_SIZE, cursor: args.cursor });

    let inserted = 0;
    for (const row of page.page) {
      let chatId: number | undefined;
      let addedAt: number;
      let source: "activity" | "manual";
      if (args.table === "users") {
        const user = row as { homeChatId?: number; _creationTime: number; userId: number };
        chatId = user.homeChatId;
        addedAt = Math.floor(user._creationTime);
        source = "manual";
      } else {
        const turn = row as { chatId: number; createdAt: number };
        chatId = turn.chatId;
        addedAt = turn.createdAt;
        source = "activity";
      }
      if (chatId === undefined || ENDED_COURSE_CHAT_IDS.has(chatId)) continue;
      const userId = row.userId;

      const existing = await ctx.db
        .query("channelStudents")
        .withIndex("by_chat_user", (q) => q.eq("chatId", chatId!).eq("userId", userId))
        .first();
      if (!existing) {
        await ctx.db.insert("channelStudents", { chatId, userId, source, addedAt });
        inserted++;
      } else if (addedAt < existing.addedAt) {
        // Enrolled since she first appeared here, whichever page that was on
        await ctx.db.patch(existing._id, { addedAt });
      }
    }
    return { inserted, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const totals: Record<string, number> = {};
    for (const table of ["participationHistory", "turnQueue", "users"] as const) {
      let cursor: string | null = null;
      totals[table] = 0;
      for (;;) {
        const result: { inserted: number; isDone: boolean; continueCursor: string } =
          await ctx.runMutation(internal.migrations.enrollStudents.backfillPage, { table, cursor });
        totals[table] += result.inserted;
        if (result.isDone) break;
        cursor = result.continueCursor;
      }
    }
    console.log("Enrolled students, by source table:", totals);
    return totals;
  },
});

/** Per-course roster size and the same-name pairs the roster will flag. */
export const report = internalQuery({
  args: {},
  handler: async (ctx) => {
    const enrollments = await ctx.db.query("channelStudents").collect();
    const users = new Map((await ctx.db.query("users").collect()).map((u) => [u.userId, u]));
    const byChat = new Map<number, typeof enrollments>();
    for (const e of enrollments) {
      if (e.removedAt !== undefined) continue;
      byChat.set(e.chatId, [...(byChat.get(e.chatId) ?? []), e]);
    }
    return [...byChat.entries()].map(([chatId, rows]) => {
      const names = new Map<string, number[]>();
      for (const row of rows) {
        const user = users.get(row.userId);
        if (!user) continue;
        const key = normalizeName(studentDisplayName(user));
        names.set(key, [...(names.get(key) ?? []), row.userId]);
      }
      return {
        chatId,
        students: rows.length,
        duplicates: [...names.entries()].filter(([, ids]) => ids.length > 1)
          .map(([name, userIds]) => ({ name, userIds })),
      };
    });
  },
});
