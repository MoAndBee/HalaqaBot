import { botConvexClient } from "./convex-client";
import { api } from "@halakabot/db";

const CONVEX_URL = process.env.CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error("Missing CONVEX_URL environment variable");
}

const convex = await botConvexClient(CONVEX_URL);

async function manualFixes() {
  console.log("🔧 Applying manual fixes...\n");
  console.log("=" .repeat(80));

  // Fix 1: User 6510746059 has wrong name (wrote someone else's name)
  // Their telegram name is "هدى شاهين" which is likely correct
  console.log("\n✏️  Fix 1: User 6510746059 (wrote friend's name by mistake)");
  const user1 = await convex.query(api.queries.getUser, { userId: 6510746059 });
  console.log("   Current realName: جهاد عبد القادر حليمة");
  console.log("   Correct name: هدى شاهين (from Telegram name)");
  await convex.mutation(api.mutations.upsertUser, {
    userId: 6510746059,
    username: user1?.username,
    telegramName: user1?.telegramName || "هدى شاهين",
    realName: "هدى شاهين",
    sourceMessageText: "Manual correction - user wrote friend's name by mistake",
  });
  console.log("   ✅ Updated!");

  // Fix 2: User 5251826669 is missing first name "بسمه"
  console.log("\n✏️  Fix 2: User 5251826669 (missing first name)");
  const user2 = await convex.query(api.queries.getUser, { userId: 5251826669 });
  console.log("   Current realName: كامل اسماعيل");
  console.log("   Correct name: بسمه كامل اسماعيل");
  await convex.mutation(api.mutations.upsertUser, {
    userId: 5251826669,
    username: user2?.username,
    telegramName: user2?.telegramName || "بـسـمـه",
    realName: "بسمه كامل اسماعيل",
    sourceMessageText: user2?.sourceMessageText,
  });
  console.log("   ✅ Updated!");

  // Fix 3: User 1125015338 has multiple people's names from a list
  console.log("\n✏️  Fix 3: User 1125015338 (list message with multiple names)");
  const user3 = await convex.query(api.queries.getUser, { userId: 1125015338 });
  console.log("   Current realName: مريم محمد على ميادة أحمد سنوسي حفيظة أحمد الباروني...");
  console.log("   Correct name: أسماء محمد (from Telegram name)");
  await convex.mutation(api.mutations.upsertUser, {
    userId: 1125015338,
    username: user3?.username,
    telegramName: user3?.telegramName || "أسماء محمد",
    realName: "أسماء محمد",
    sourceMessageText: "Manual correction - message contained multiple names from a list",
  });
  console.log("   ✅ Updated!");

  // Fix 4: User 1206847834 also has multiple names from a list
  console.log("\n✏️  Fix 4: User 1206847834 (list message with multiple names)");
  const user4 = await convex.query(api.queries.getUser, { userId: 1206847834 });
  console.log(`   Current realName: ${user4?.realName}`);
  console.log(`   Telegram name: ${user4?.telegramName}`);
  console.log("   Correct name: مريم إبراهيم (from Telegram name)");
  await convex.mutation(api.mutations.upsertUser, {
    userId: 1206847834,
    username: user4?.username,
    telegramName: user4?.telegramName || "مريم إبراهيم",
    realName: "مريم إبراهيم",
    sourceMessageText: "Manual correction - message contained multiple names from a list",
  });
  console.log("   ✅ Updated!");

  // Fix 5 & 6: Users without names in messages - use Telegram names
  console.log("\n✏️  Fix 5: User 6033534422 (no name in messages)");
  const user5 = await convex.query(api.queries.getUser, { userId: 6033534422 });
  console.log("   Using Telegram name: نُورَا");
  await convex.mutation(api.mutations.upsertUser, {
    userId: 6033534422,
    username: user5?.username,
    telegramName: user5?.telegramName || "نُورَا",
    realName: "نُورَا",
    sourceMessageText: "From Telegram name - no name found in messages",
  });
  console.log("   ✅ Updated!");

  console.log("\n✏️  Fix 6: User 7961135147 (no name in messages)");
  const user6 = await convex.query(api.queries.getUser, { userId: 7961135147 });
  console.log("   Using Telegram name: سوزان جوهر");
  await convex.mutation(api.mutations.upsertUser, {
    userId: 7961135147,
    username: user6?.username,
    telegramName: user6?.telegramName || "سوزان جوهر",
    realName: "سوزان جوهر",
    sourceMessageText: "From Telegram name - no name found in messages",
  });
  console.log("   ✅ Updated!");

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ All manual fixes complete!");
}

manualFixes()
  .then(() => {
    console.log("\n✓ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Fatal error:", error);
    process.exit(1);
  });
