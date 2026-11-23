/**
 * The Students page: a course's roster, and adding or removing students from it.
 * See enrollment.ts for what being on a roster means.
 */
import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requireChatAccess } from "./auth";
import {
  enrollStudent,
  getEnrollment,
  normalizeName,
  searchableStudentIds,
  studentDisplayName,
} from "./enrollment";
import { ADMIN_PASSCODE } from "./mutations";

const rosterEntry = v.object({
  userId: v.number(),
  name: v.string(),
  telegramName: v.string(),
  username: v.optional(v.string()),
  // Registered by hand, with no Telegram account
  isManual: v.boolean(),
  // Set when another student on this roster has the same name (spelling
  // variants folded): likely one person with two accounts. Shared by the pair.
  duplicateKey: v.union(v.string(), v.null()),
});

/**
 * Everyone on this course's roster, alphabetically, each flagged when another
 * student here has the same name. Computed on read, so a rename or a removal
 * updates the flag with no stored state to keep in step.
 */
export const getRoster = query({
  args: { chatId: v.number() },
  returns: v.array(rosterEntry),
  handler: async (ctx, args) => {
    await requireChatAccess(ctx, args.chatId);
    const enrollments = await ctx.db
      .query("channelStudents")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();

    const students: Doc<"users">[] = [];
    for (const enrollment of enrollments) {
      if (enrollment.removedAt !== undefined) continue;
      const user = await ctx.db
        .query("users")
        .withIndex("by_user_id", (q) => q.eq("userId", enrollment.userId))
        .first();
      if (user) students.push(user);
    }

    const byName = new Map<string, number>();
    for (const user of students) {
      const key = normalizeName(studentDisplayName(user));
      byName.set(key, (byName.get(key) ?? 0) + 1);
    }

    return students
      .map((user) => {
        const name = studentDisplayName(user);
        const key = normalizeName(name);
        return {
          userId: user.userId,
          name,
          telegramName: user.telegramName,
          username: user.username,
          isManual: user.userId < 0,
          duplicateKey: (byName.get(key) ?? 0) > 1 ? key : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ar") || a.userId - b.userId);
  },
});

/**
 * Search every student (all courses — one organization for now, see
 * searchableStudentIds) to add one to this course, with where she stands here.
 */
export const searchAllStudents = query({
  args: { chatId: v.number(), query: v.string() },
  returns: v.array(
    v.object({
      userId: v.number(),
      name: v.string(),
      telegramName: v.string(),
      username: v.optional(v.string()),
      isManual: v.boolean(),
      // "enrolled": on this roster; "removed": was, and can be added back
      status: v.union(v.literal("enrolled"), v.literal("removed"), v.literal("none")),
    })
  ),
  handler: async (ctx, args) => {
    const caller = await requireChatAccess(ctx, args.chatId);
    const wanted = normalizeName(args.query);
    if (wanted === "") return [];

    const scope = await searchableStudentIds(ctx, caller);
    const users = await ctx.db.query("users").collect();
    const matches = users
      .filter((u) => scope === null || scope.has(u.userId))
      .filter((u) =>
        [u.realName ?? "", u.telegramName, u.username ?? ""].some((field) =>
          normalizeName(field).includes(wanted)
        )
      )
      .slice(0, 20);

    const results: {
      userId: number; name: string; telegramName: string; username?: string;
      isManual: boolean; status: "enrolled" | "removed" | "none";
    }[] = [];
    for (const user of matches) {
      const enrollment = await getEnrollment(ctx, args.chatId, user.userId);
      results.push({
        userId: user.userId,
        name: studentDisplayName(user),
        telegramName: user.telegramName,
        username: user.username,
        isManual: user.userId < 0,
        status: !enrollment ? "none" : enrollment.removedAt === undefined ? "enrolled" : "removed",
      });
    }
    return results;
  },
});

/** Put an existing student on this course's roster, or back on it. */
export const addStudentToCourse = mutation({
  args: { chatId: v.number(), userId: v.number(), passcode: v.string() },
  handler: async (ctx, args) => {
    const caller = await requireChatAccess(ctx, args.chatId);
    if (args.passcode !== ADMIN_PASSCODE) throw new ConvexError("رمز الحماية غير صحيح");
    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();
    if (!user) throw new ConvexError("الطالبة غير موجودة");
    await enrollStudent(ctx, args.chatId, args.userId, "manual", caller.kind === "user" ? caller.userId : undefined);
  },
});

/**
 * Take a student off this course's roster. Her halaqa data stays as it is;
 * she just stops being listed or offered, and admins can't add her to halaqas.
 */
export const removeStudentFromCourse = mutation({
  args: { chatId: v.number(), userId: v.number(), passcode: v.string() },
  handler: async (ctx, args) => {
    await requireChatAccess(ctx, args.chatId);
    if (args.passcode !== ADMIN_PASSCODE) throw new ConvexError("رمز الحماية غير صحيح");
    const enrollment = await getEnrollment(ctx, args.chatId, args.userId);
    if (!enrollment || enrollment.removedAt !== undefined) {
      throw new ConvexError("الطالبة ليست في قائمة هذه الدورة");
    }
    await ctx.db.patch(enrollment._id, { removedAt: Date.now() });
  },
});
