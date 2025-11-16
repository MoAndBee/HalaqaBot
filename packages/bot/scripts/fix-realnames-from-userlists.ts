import { ConvexHttpClient } from "convex/browser";
import { api } from "@halakabot/db";

const CONVEX_URL = process.env.CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error("Missing CONVEX_URL environment variable");
}

const convex = new ConvexHttpClient(CONVEX_URL);

async function fixRealNamesFromUserLists() {
  console.log("🔄 Fixing realNames using userLists displayName...\n");

  // Get all users
  const allUsers = await convex.query(api.queries.getAllUsers, {});

  console.log(`Total users: ${allUsers.length}\n`);
  console.log("=" .repeat(80));

  let updated = 0;
  let skipped = 0;
  let noDisplayName = 0;

  for (const user of allUsers) {
    console.log(`\n👤 User ${user.userId} (${user.telegramName})`);
    console.log(`   Current realName: ${user.realName || "NOT SET"}`);

    // Get all posts to find userList entries for this user
    const allPosts = await convex.query(api.queries.getAllPosts, {});

    let displayName: string | null = null;

    // Look for this user in userLists
    for (const post of allPosts) {
      const userList = await convex.query(api.queries.getUserList, {
        chatId: post.chatId,
        postId: post.postId,
      });

      const allListUsers = [...userList.activeUsers, ...userList.completedUsers];
      const userInList = allListUsers.find(u => u.id === user.userId);

      if (userInList && userInList.displayName && userInList.displayName.trim()) {
        displayName = userInList.displayName.trim();
        console.log(`   ✅ Found displayName in userList: "${displayName}"`);
        break;
      }
    }

    if (displayName) {
      // Update the user's realName with the displayName
      await convex.mutation(api.mutations.upsertUser, {
        userId: user.userId,
        username: user.username,
        telegramName: user.telegramName,
        realName: displayName,
        sourceMessageText: "From userList displayName",
      });

      console.log(`   ✅ Updated realName to: "${displayName}"`);
      updated++;
    } else {
      console.log(`   ℹ️  No displayName found in userLists`);
      noDisplayName++;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Fix complete!");
  console.log(`   Total users: ${allUsers.length}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   No displayName found: ${noDisplayName}`);
}

fixRealNamesFromUserLists()
  .then(() => {
    console.log("\n✓ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Fatal error:", error);
    process.exit(1);
  });
