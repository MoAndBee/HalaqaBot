import { ConvexHttpClient } from "convex/browser";
import { api } from "@halakabot/db";

const CONVEX_URL = process.env.CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error("Missing CONVEX_URL environment variable");
}

const convex = new ConvexHttpClient(CONVEX_URL);

async function investigateMissingRealNames() {
  console.log("🔍 Investigating users without realNames...\n");

  // Get all users
  const allUsers = await convex.query(api.queries.getAllUsers, {});
  console.log(`Total users: ${allUsers.length}`);

  const usersWithoutRealName = allUsers.filter(u => !u.realName);
  console.log(`Users without realName: ${usersWithoutRealName.length}\n`);

  console.log("=" .repeat(80));

  // For each user without realName, check their messages
  for (const user of usersWithoutRealName.slice(0, 10)) { // Check first 10 to avoid too much output
    console.log(`\n👤 User ID: ${user.userId}`);
    console.log(`   Telegram name: ${user.telegramName}`);
    console.log(`   Username: ${user.username || "N/A"}`);

    // Get all message classifications
    const allClassifications = await convex.query(api.queries.getAllMessageClassifications, {});

    // Find classifications for this user's messages
    const userMessages = allClassifications.filter(c => {
      // We need to check if this message is from this user
      // We'll need to check against messageAuthors
      return true; // We'll filter this properly below
    });

    // Get messageAuthors for this specific user (we need a custom approach here)
    // Let's just check a specific known message if provided

    console.log(`\n   Checking for message with text containing names...`);

    // Check if there are any classifications for messages from this user
    let foundMessage = false;
    for (const classification of allClassifications) {
      if (classification.messageText && classification.messageText.trim()) {
        // This is a workaround - we need to check via messageAuthors
        // For now, let's just look at what we have

        // We'll check the specific case you mentioned
        if (user.userId === 6181119649) {
          console.log(`\n   🔍 Special case: User 6181119649`);
          console.log(`   Checking classifications...`);

          // Find all classifications
          const userClassifications = allClassifications.filter(c =>
            c.containsName && c.detectedNames && c.detectedNames.length > 0
          );

          console.log(`   Total classifications with names: ${userClassifications.length}`);

          if (userClassifications.length > 0) {
            console.log(`\n   📋 Sample classifications with names:`);
            userClassifications.slice(0, 3).forEach(c => {
              console.log(`      Message ${c.messageId}:`);
              console.log(`         Text: "${c.messageText}"`);
              console.log(`         Detected names: [${c.detectedNames.join(', ')}]`);
            });
          }

          foundMessage = true;
          break;
        }
      }
    }

    if (!foundMessage && user.userId !== 6181119649) {
      console.log(`   ℹ️  No classifications found for this user's messages`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Investigation complete!");
  console.log(`\nSummary:`);
  console.log(`   Total users: ${allUsers.length}`);
  console.log(`   Without realName: ${usersWithoutRealName.length}`);
  console.log(`   With realName: ${allUsers.length - usersWithoutRealName.length}`);
}

investigateMissingRealNames()
  .then(() => {
    console.log("\n✓ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Fatal error:", error);
    process.exit(1);
  });
