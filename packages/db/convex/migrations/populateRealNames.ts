import { mutation } from "../_generated/server";

/**
 * One-off migration: populate `realName` for users whose full 3-part name is
 * recoverable but was never stored in the `realName` field.
 *
 * Each entry is keyed by Telegram `userId`. Names are marked verified so the
 * auto-classifier won't overwrite them later (see storeClassification, which
 * only updates when realName is missing or unverified).
 *
 * Idempotent: re-running only patches rows whose realName differs from target.
 *
 * Sources:
 *   1. TELEGRAM  — full 3-part name already present in the Telegram display name
 *      ("اسم كامل جاهز للنقل" from the data-quality review).
 *   2. CSV       — matched against the offline registration form (الاسم الثلاثي)
 *      by Telegram username/معرف. High confidence: username matched exactly.
 *   3. CSV (name)— matched to a CSV row by a distinctive name only (no handle in
 *      the form). Lower confidence — review before trusting blindly.
 */
const NAMES: Array<{ userId: number; realName: string }> = [
  // ── 1. From Telegram display name (original 15) ──────────────────────────
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
  // Corrected from "الاء خالد عبدالغني": the CSV registration form (الاء خالد
  // فرغلي) and the username `alaafarghali_87` both indicate فرغلي, not عبدالغني.
  { userId: 7730192247, realName: "الاء خالد فرغلي" },
  { userId: 1825217484, realName: "اسلام المحمدي الشيخ" },
  { userId: 366693257, realName: "Asmaa S Mohamed" },

  // ── 2. From CSV, matched by Telegram username (high confidence) ───────────
  { userId: 5339050460, realName: "نورا فؤاد حسن" }, // Norafouad
  { userId: 1144063520, realName: "ضحى جمال عزت" }, // D7398
  { userId: 5086703253, realName: "اسماء ثابت أبو اليزيد" }, // asma23691
  { userId: 8244879335, realName: "فاتن عبدالله السعيد محمد" }, // Hana_Elkahky
  { userId: 7215388345, realName: "مروة حمادي المحمد" }, // mrasi55
  { userId: 1604287913, realName: "فرح عبد المنعم محمد" }, // karmoty
  { userId: 236275611, realName: "ربا مختار عباس" }, // RobaMokhtar
  { userId: 5586141863, realName: "سارة هشام محمد جلال" }, // Sarah_Hisham5
  { userId: 7369318132, realName: "حفيظة أحمد عبدالله" }, // A392002B
  { userId: 1204715993, realName: "شريفة علي سعد القحطاني" }, // LKLKLKLKLKL0
  { userId: 6714582847, realName: "مروه رضا محمد" }, // Marwawagdi
  { userId: 6086239776, realName: "ايمان مجدي حلمي" }, // lyaann45
  { userId: 703123828, realName: "نوران احمد محمد" }, // omnju (was 2-part "نوران أحمد")
  { userId: 1604770491, realName: "راندا صابر أحمد" }, // httpstmeRanda (fixes joined "صابرأحمد")

  // ── 3. From CSV, matched by distinctive name only (review recommended) ────
  { userId: 5631170758, realName: "هاجر شوقى عبدالله" }, // username Hagar_shawky99 corroborates
  { userId: 1483782502, realName: "جهاد حسام الدين عزب" }, // was 2-part "جهاد حسام الدين"
  { userId: 841355278, realName: "نسرين ميرغني عبد الرحمن" },
  { userId: 7073879196, realName: "آمال محمود عيسى" },
  { userId: 5560393120, realName: "عزه سعيد إسماعيل" },

  // ── 4. Corrections: stored realName was wrong; CSV + username agree ───────
  // Stored names below were mis-scraped from list messages. The registration
  // form and the Telegram username both point to the corrected value.
  { userId: 619856390, realName: "نادين وائل يسري" }, // was "أسماء فهمي التهامي"; @nadeenwaell
  { userId: 1787404332, realName: "إسراء محمد حلمي" }, // was "نادية محمد كامل"; @Esraa_Helmy55
  { userId: 475414405, realName: "هبة الله السيد هويدي" }, // was "...حسن"; @Hebahwedi7 / "Heba Howedi"
  // Telegram had الزعيري, registration had عبدالناصر — keep both, عبدالناصر first.
  { userId: 635968953, realName: "أمنية جمال عبدالناصر الزعيري" }, // @OmniaElzeary

  // ── 5. Enrichment: stored 3-part name extended with the CSV's 4th name ────
  { userId: 5885997783, realName: "امل عبدالنبي عبدالخالق علي" }, // @amlabdelkhaliq710
  { userId: 1450370981, realName: "هبة علي أحمد حسن" }, // @hebaaliahmed
  { userId: 681927795, realName: "هبة رفعت محمد السعيد" }, // @hebarefaat
  { userId: 5980097337, realName: "مرام محمد نجيب انور" }, // @Maram_anwer
  { userId: 8575956780, realName: "إيمان أحمد الحاج أحمد" }, // @emy_jasmine
  { userId: 1074553931, realName: "عايدة محمد فوزي سالم" }, // @aidamohamed1307
  { userId: 2112371728, realName: "فاطمة محمد أحمد يونس" }, // @Fatmamohamedyouns
  { userId: 1724475367, realName: "إسراء أحمد إبراهيم نعيم" }, // @emtcoesraaahmed
  { userId: 1324208937, realName: "رقية عبد السميع محمود إبراهيم" }, // @Rokaia_Abdelsamia
  { userId: 5330423160, realName: "إيمان رشاد عبدالحميد احمد" }, // @emanrashad12
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
