/**
 * Script to check if sourceMessageText in users table matches the actual message text in messageAuthors table
 */

import { ConvexHttpClient } from "@halakabot/db";
import { api } from "@halakabot/db";
import "dotenv/config";

const CONVEX_URL = process.env.CONVEX_URL;
if (!CONVEX_URL) {
  throw new Error("CONVEX_URL environment variable is required");
}

const convex = new ConvexHttpClient(CONVEX_URL);

async function checkSourceMessageConsistency() {
  console.log("🔍 Checking sourceMessageText consistency...\n");

  // Get all users with sourceMessageText
  const users = await convex.query(api.queries.getAllUsers);
  const usersWithSource = users.filter(
    (user) => user.sourceMessageText && user.sourceMessageText.trim().length > 0
  );

  console.log(`Found ${usersWithSource.length} users with sourceMessageText\n`);

  let inconsistentCount = 0;
  let matchCount = 0;

  for (const user of usersWithSource) {
    // Get all messages by this user
    const userMessages = await convex.query(api.queries.getMessagesByUserId, {
      userId: user.userId,
    });

    // Check if sourceMessageText matches ANY of their messages
    const matchingMessage = userMessages.find(
      (msg) => msg.messageText === user.sourceMessageText
    );

    if (!matchingMessage) {
      console.log(`❌ INCONSISTENT: User ${user.userId}`);
      console.log(`   Real name: ${user.realName}`);
      console.log(`   Telegram name: ${user.telegramName}`);
      console.log(`   sourceMessageText: "${user.sourceMessageText}"`);
      console.log(`   Number of messages in DB: ${userMessages.length}`);
      if (userMessages.length > 0) {
        console.log(`   Their actual messages:`);
        userMessages.forEach((msg, i) => {
          console.log(`     [${i + 1}] "${msg.messageText}"`);
        });
      }
      console.log("");
      inconsistentCount++;
    } else {
      matchCount++;
    }
  }

  console.log("\n📊 Summary:");
  console.log(`   Total users with sourceMessageText: ${usersWithSource.length}`);
  console.log(`   ✅ Consistent (matches a message): ${matchCount}`);
  console.log(`   ❌ Inconsistent (no matching message): ${inconsistentCount}`);

  if (inconsistentCount > 0) {
    console.log(`\n⚠️  Found ${inconsistentCount} users where sourceMessageText doesn't match any of their messages!`);
  } else {
    console.log("\n✅ All sourceMessageText entries match their corresponding messages");
  }
}

checkSourceMessageConsistency()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
