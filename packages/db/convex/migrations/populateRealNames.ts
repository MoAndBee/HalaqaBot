import { mutation } from "../_generated/server";

/**
 * One-off migration: populate `realName` for the 15 users whose full 3-part
 * name is already present in their Telegram name but was never copied into the
 * `realName` field ("اسم كامل جاهز للنقل").
 *
 * Each entry is keyed by Telegram `userId`. The name is set and marked verified
 * so the auto-classifier won't overwrite it later (see storeClassification,
 * which only updates when realName is missing or unverified).
 *
 * Idempotent: re-running only patches rows whose realName differs from target.
 */
const NAMES: Array<{ userId: number; realName: string }> = [
  { userId: 83674093, realName: "سارة شريف علي" },
  { userId: 6012695366, realName: "رقية محمود السني" },
  { userId: 1648654053, realName: "نجلاء فتحي حسين" },
  { userId: 6279669037, realName: "صفاء جلال محمد دسوقي" },
  { userId: 381304728, realName: "مؤمنة محمد عبد الهادي" },
  { userId: 1529744839, realName: "بسمة محمد سعيد" },
  { userId: 1382801811, realName: "دينا عبد الله السماحي" },
  { userId: 458485535, realName: "آية أحمد كردي" },
  { userId: 265345092, realName: "نورا السيد محمد" },
  { userId: 5182866864, realName: "رويدا محمد عبدالمنعم" },
  { userId: 7945965923, realName: "سحر ناصر خليفة" },
  { userId: 5884059087, realName: "ملك عماد يوسف" },
  { userId: 7730192247, realName: "الاء خالد عبدالغني" },
  { userId: 1825217484, realName: "اسلام المحمدي الشيخ" },
  { userId: 366693257, realName: "Asmaa S Mohamed" },
];

export default mutation({
  args: {},
  handler: async (ctx) => {
    const updated: number[] = [];
    const skipped: number[] = [];
    const notFound: number[] = [];

    for (const { userId, realName } of NAMES) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .unique();

      if (!user) {
        notFound.push(userId);
        console.log(`⚠️ userId ${userId} not found in users table`);
        continue;
      }

      if (user.realName === realName && user.realNameVerified) {
        skipped.push(userId);
        console.log(`⏭️ userId ${userId} already set to "${realName}"`);
        continue;
      }

      await ctx.db.patch(user._id, {
        realName,
        realNameVerified: true,
        updatedAt: Date.now(),
      });
      updated.push(userId);
      console.log(
        `✅ userId ${userId}: "${user.realName ?? "(empty)"}" → "${realName}"`,
      );
    }

    const result = {
      total: NAMES.length,
      updated: updated.length,
      skipped: skipped.length,
      notFound: notFound.length,
      updatedIds: updated,
      skippedIds: skipped,
      notFoundIds: notFound,
    };
    console.log("Done:", JSON.stringify(result));
    return result;
  },
});
