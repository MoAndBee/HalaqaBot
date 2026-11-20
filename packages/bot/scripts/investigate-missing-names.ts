import { botConvexClient } from "./convex-client";
import { api } from "@halakabot/db";

const CONVEX_URL = process.env.CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error("Missing CONVEX_URL environment variable");
}

const convex = await botConvexClient(CONVEX_URL);

async function investigateMissingNames() {
  console.log("🔍 Investigating users without realNames...\n");

  const allUsers = await convex.query(api.queries.getAllUsers, {});
  const usersWithoutRealName = allUsers.filter(u => !u.realName);

  console.log(`Found ${usersWithoutRealName.length} users without realName\n`);
  console.log("=" .repeat(80));

  for (const user of usersWithoutRealName) {
    console.log(`\n👤 User ${user.userId} (${user.telegramName})`);

    // Get messages from this user
    const messages = await convex.query(api.queries.getMessagesByUserId, {
      userId: user.userId,
    });

    console.log(`   Total messages: ${messages.length}`);

    for (const message of messages) {
      console.log(`\n   📧 Message ${message.messageId}:`);
      console.log(`      Text: "${message.messageText || '[NO TEXT]'}"`);

      // Check if classified
      const classification = await convex.query(api.queries.getClassification, {
        chatId: message.chatId,
        postId: message.postId,
        messageId: message.messageId,
      });

      if (classification) {
        console.log(`      ✅ Classified: containsName=${classification.containsName}`);
        if (classification.detectedNames && classification.detectedNames.length > 0) {
          console.log(`      📝 Detected names: [${classification.detectedNames.join(', ')}]`);
        } else {
          console.log(`      📝 No names detected`);
        }
      } else {
        console.log(`      ❌ Not classified yet`);
      }
    }

    console.log("\n   " + "-".repeat(76));
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Investigation complete!");
}

investigateMissingNames()
  .then(() => {
    console.log("\n✓ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Fatal error:", error);
    process.exit(1);
  });
