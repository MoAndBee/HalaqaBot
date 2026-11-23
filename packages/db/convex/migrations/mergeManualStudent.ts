import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";

/**
 * Fold a hand-registered student (negative userId) into her Telegram account:
 * her turns, history and course enrollments move to the Telegram account, then
 * the hand-registered users row is deleted. Refuses, changing nothing, if the
 * Telegram account already has a turn of the same type in the same halaqa.
 *
 * Pass dryRun: true first to see what would move.
 *
 * Decided 2026-11-23 for نورا فؤاد حسن, whose one exam score (9) sat on her
 * hand-registered account. Run once after deploy, before enrollStudents:
 *   bunx convex run migrations/mergeManualStudent:mergeManualStudent \
 *     '{"manualUserId": -2, "telegramUserId": 5339050460, "dryRun": true}'
 */
export const mergeManualStudent = internalMutation({
  args: { manualUserId: v.number(), telegramUserId: v.number(), dryRun: v.boolean() },
  handler: async (ctx, args) => {
    if (args.manualUserId >= 0) throw new ConvexError("manualUserId must be a hand-registered (negative) id");
    if (args.telegramUserId <= 0) throw new ConvexError("telegramUserId must be a Telegram (positive) id");

    const findUser = (userId: number) =>
      ctx.db.query("users").withIndex("by_user_id", (q) => q.eq("userId", userId)).first();
    const manual = await findUser(args.manualUserId);
    const telegram = await findUser(args.telegramUserId);
    if (!manual) throw new ConvexError(`No user ${args.manualUserId}`);
    if (!telegram) throw new ConvexError(`No user ${args.telegramUserId}`);

    const queue = await ctx.db.query("turnQueue")
      .withIndex("by_user", (q) => q.eq("userId", args.manualUserId)).collect();
    const history = await ctx.db.query("participationHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.manualUserId)).collect();
    const enrollments = await ctx.db.query("channelStudents")
      .withIndex("by_user", (q) => q.eq("userId", args.manualUserId)).collect();

    // Her Telegram account must not already hold the same turn in the same halaqa
    const slot = (r: { chatId: number; postId: number; sessionNumber: number; sessionType?: string }) =>
      `${r.chatId}/${r.postId}/${r.sessionNumber}/${r.sessionType ?? ""}`;
    const taken = new Set([
      ...(await ctx.db.query("turnQueue")
        .withIndex("by_user", (q) => q.eq("userId", args.telegramUserId)).collect()).map(slot),
      ...(await ctx.db.query("participationHistory")
        .withIndex("by_user", (q) => q.eq("userId", args.telegramUserId)).collect()).map(slot),
    ]);
    const clashes = [...queue, ...history].filter((r) => taken.has(slot(r))).map(slot);
    if (clashes.length > 0) {
      throw new ConvexError(`Telegram account already has these turns: ${clashes.join(", ")}`);
    }

    const plan = {
      manual: { userId: manual.userId, realName: manual.realName },
      telegram: { userId: telegram.userId, telegramName: telegram.telegramName, username: telegram.username },
      turnQueue: queue.map((r) => r._id),
      participationHistory: history.map((r) => ({
        _id: r._id, chatId: r.chatId, postId: r.postId, sessionNumber: r.sessionNumber,
        sessionType: r.sessionType, score: r.score,
      })),
      enrollments: enrollments.map((r) => r.chatId),
      deleteUser: manual._id,
    };
    if (args.dryRun) return { dryRun: true, ...plan };

    for (const row of [...queue, ...history]) await ctx.db.patch(row._id, { userId: args.telegramUserId });
    for (const row of enrollments) {
      const already = await ctx.db.query("channelStudents")
        .withIndex("by_chat_user", (q) => q.eq("chatId", row.chatId).eq("userId", args.telegramUserId))
        .first();
      if (already) await ctx.db.delete(row._id);
      else await ctx.db.patch(row._id, { userId: args.telegramUserId });
    }
    await ctx.db.delete(manual._id);
    console.log(`Merged hand-registered ${args.manualUserId} into ${args.telegramUserId}`, plan);
    return { dryRun: false, ...plan };
  },
});
