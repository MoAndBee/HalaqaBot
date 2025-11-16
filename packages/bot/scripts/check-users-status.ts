import { ConvexHttpClient } from "convex/browser";
import { api } from "@halakabot/db";

const CONVEX_URL = process.env.CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error("Missing CONVEX_URL environment variable");
}

const convex = new ConvexHttpClient(CONVEX_URL);

async function checkUsersStatus() {
  console.log("📊 Checking users status...\n");

  const allUsers = await convex.query(api.queries.getAllUsers, {});

  const usersWithRealName = allUsers.filter(u => u.realName);
  const usersWithoutRealName = allUsers.filter(u => !u.realName);

  console.log("=" .repeat(80));
  console.log(`Total users: ${allUsers.length}`);
  console.log(`✅ Users with realName: ${usersWithRealName.length}`);
  console.log(`❌ Users without realName: ${usersWithoutRealName.length}`);
  console.log("=" .repeat(80));

  if (usersWithoutRealName.length > 0) {
    console.log("\n❌ Users still missing realName:\n");
    for (const user of usersWithoutRealName) {
      console.log(`   👤 User ${user.userId}`);
      console.log(`      Telegram name: ${user.telegramName}`);
      console.log(`      Username: ${user.username || 'N/A'}`);

      // Get message count
      const messages = await convex.query(api.queries.getMessagesByUserId, {
        userId: user.userId,
      });
      console.log(`      Messages: ${messages.length}`);
      console.log();
    }
  }

  console.log("\n✅ Recently updated users with realName:\n");
  const sortedByUpdate = [...usersWithRealName].sort((a, b) => b.updatedAt - a.updatedAt);
  const recent = sortedByUpdate.slice(0, 5);

  for (const user of recent) {
    console.log(`   👤 User ${user.userId}`);
    console.log(`      Telegram name: ${user.telegramName}`);
    console.log(`      Real name: ${user.realName}`);
    console.log(`      Source: ${user.sourceMessageText?.substring(0, 50)}...`);
    console.log(`      Updated: ${new Date(user.updatedAt).toLocaleString()}`);
    console.log();
  }
}

checkUsersStatus()
  .then(() => {
    console.log("\n✓ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Fatal error:", error);
    process.exit(1);
  });
