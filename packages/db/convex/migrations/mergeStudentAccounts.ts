import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { enrollStudent, getEnrollment } from "../enrollment";

/**
 * A student who moved to a new Telegram account, within one course: move the
 * old account's turns and history in that course to the new account, put the
 * new account on the roster and take the old one off it (soft remove), so
 * admins stop picking the old account by its identical name.
 *
 * Only this course changes. The old account keeps its users row and its turns
 * in other courses: it really was hers there.
 *
 * A turn the new account already holds (same halaqa, same type) is not moved
 * and is listed under `clashes`, with both scores, for someone to decide. Once
 * decided that the new account's turn stands, pass onClash: "keepNew" to delete
 * the old account's clashing turns.
 * Pass dryRun: true first to see what would move.
 *
 * Decided 2026-11-23 for the Aal Imran course (chat -1003931211469), where the
 * old account had no messages but admins kept adding turns to it. See
 * docs/student-rosters-rollout.md for the four account pairs.
 */
export const mergeStudentAccounts = internalMutation({
  args: {
    chatId: v.number(),
    fromUserId: v.number(),
    toUserId: v.number(),
    dryRun: v.boolean(),
    // "leave" (default): clashing turns stay on the old account.
    // "keepNew": they are deleted; the new account's turn stands.
    onClash: v.optional(v.union(v.literal("leave"), v.literal("keepNew"))),
  },
  handler: async (ctx, args) => {
    if (args.fromUserId === args.toUserId) throw new ConvexError("fromUserId and toUserId are the same");
    for (const userId of [args.fromUserId, args.toUserId]) {
      const user = await ctx.db.query("users").withIndex("by_user_id", (q) => q.eq("userId", userId)).first();
      if (!user) throw new ConvexError(`No user ${userId}`);
    }

    const inChat = async (userId: number) => ({
      queue: await ctx.db.query("turnQueue")
        .withIndex("by_user_chat", (q) => q.eq("userId", userId).eq("chatId", args.chatId)).collect(),
      history: await ctx.db.query("participationHistory")
        .withIndex("by_user_chat", (q) => q.eq("userId", userId).eq("chatId", args.chatId)).collect(),
    });
    const from = await inChat(args.fromUserId);
    const to = await inChat(args.toUserId);

    type Turn = { _id: string; postId: number; sessionNumber: number; sessionType?: string; score?: number };
    const slot = (r: Turn) => `${r.postId}/${r.sessionNumber}/${r.sessionType ?? ""}`;
    const held = new Map<string, Turn>([...to.queue, ...to.history].map((r) => [slot(r), r]));
    const describe = (table: string) => (r: Turn) => ({
      table, _id: r._id, postId: r.postId, sessionNumber: r.sessionNumber, sessionType: r.sessionType, score: r.score,
    });

    const moving = [
      ...from.queue.filter((r) => !held.has(slot(r))).map(describe("turnQueue")),
      ...from.history.filter((r) => !held.has(slot(r))).map(describe("participationHistory")),
    ];
    const clashes = [...from.queue, ...from.history]
      .filter((r) => held.has(slot(r)))
      .map((r) => ({ old: describe("old")(r), new: describe("new")(held.get(slot(r))!) }));
    const onClash = args.onClash ?? "leave";
    const plan = { chatId: args.chatId, fromUserId: args.fromUserId, toUserId: args.toUserId, moving, clashes, onClash };
    if (args.dryRun) return { dryRun: true, ...plan };

    const movingIds = new Set(moving.map((m) => m._id));
    for (const row of [...from.queue, ...from.history]) {
      if (movingIds.has(row._id)) await ctx.db.patch(row._id, { userId: args.toUserId });
      else if (onClash === "keepNew") await ctx.db.delete(row._id);
    }
    await enrollStudent(ctx, args.chatId, args.toUserId, "activity");
    const old = await getEnrollment(ctx, args.chatId, args.fromUserId);
    if (old && old.removedAt === undefined) await ctx.db.patch(old._id, { removedAt: Date.now() });

    console.log(`Merged ${args.fromUserId} into ${args.toUserId} in chat ${args.chatId}`, plan);
    return { dryRun: false, ...plan };
  },
});
