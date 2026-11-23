import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { getEnrollment } from "../enrollment";

/**
 * Take students who have left a course off its roster, as the Students page's
 * remove button does for one: hidden from the roster and search, and admins
 * can't add them to halaqas. Their halaqa data is untouched, and signing up
 * herself through the bot puts a student back. Ids not on the roster, or
 * already removed, are reported and skipped. Pass dryRun: true first.
 *
 * Decided 2026-11-23 for the Aal Imran course (chat -1003931211469): the
 * maintainer gave the 133 students to keep; these are the other 26 (plus one
 * hand-registered duplicate merged instead). The ids are in
 * docs/student-rosters-rollout.md.
 */
export const removeStudentsFromCourse = internalMutation({
  args: { chatId: v.number(), userIds: v.array(v.number()), dryRun: v.boolean() },
  handler: async (ctx, args) => {
    const removing: { userId: number; name: string }[] = [];
    const skipped: { userId: number; reason: string }[] = [];
    for (const userId of new Set(args.userIds)) {
      const enrollment = await getEnrollment(ctx, args.chatId, userId);
      if (!enrollment) {
        skipped.push({ userId, reason: "not on this course's roster" });
        continue;
      }
      if (enrollment.removedAt !== undefined) {
        skipped.push({ userId, reason: "already removed" });
        continue;
      }
      const user = await ctx.db.query("users").withIndex("by_user_id", (q) => q.eq("userId", userId)).first();
      removing.push({ userId, name: user?.realName || user?.telegramName || `#${userId}` });
      if (!args.dryRun) await ctx.db.patch(enrollment._id, { removedAt: Date.now() });
    }
    return { dryRun: args.dryRun, chatId: args.chatId, removing, skipped };
  },
});
