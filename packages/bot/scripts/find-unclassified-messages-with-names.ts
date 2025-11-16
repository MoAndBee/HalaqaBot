import { ConvexHttpClient } from "convex/browser";
import { api } from "@halakabot/db";

const CONVEX_URL = process.env.CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error("Missing CONVEX_URL environment variable");
}

const convex = new ConvexHttpClient(CONVEX_URL);

async function findUnclassifiedMessages() {
  console.log("🔍 Finding users without realNames who have unclassified messages...\n");

  // Get all users without realNames
  const allUsers = await convex.query(api.queries.getAllUsers, {});
  const usersWithoutRealName = allUsers.filter(u => !u.realName);

  console.log(`Total users: ${allUsers.length}`);
  console.log(`Users without realName: ${usersWithoutRealName.length}\n`);
  console.log("=" .repeat(80));

  let usersWithUnclassifiedMessages = 0;
  let totalUnclassifiedMessages = 0;

  for (const user of usersWithoutRealName) {
    // Get messages from this user
    const messages = await convex.query(api.queries.getMessagesByUserId, {
      userId: user.userId,
    });

    let unclassifiedCount = 0;
    const unclassifiedWithText = [];

    for (const message of messages) {
      // Check if classified
      const classification = await convex.query(api.queries.getClassification, {
        chatId: message.chatId,
        postId: message.postId,
        messageId: message.messageId,
      });

      if (!classification && message.messageText && message.messageText.trim()) {
        unclassifiedCount++;
        unclassifiedWithText.push(message);
      }
    }

    if (unclassifiedCount > 0) {
      usersWithUnclassifiedMessages++;
      totalUnclassifiedMessages += unclassifiedCount;

      console.log(`\n👤 User ${user.userId} (${user.telegramName})`);
      console.log(`   Unclassified messages: ${unclassifiedCount}`);

      // Show first unclassified message
      if (unclassifiedWithText.length > 0) {
        const firstMsg = unclassifiedWithText[0];
        console.log(`   Sample: "${firstMsg.messageText?.substring(0, 50)}..."`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n📊 Summary:");
  console.log(`   Users without realName: ${usersWithoutRealName.length}`);
  console.log(`   Users with unclassified messages: ${usersWithUnclassifiedMessages}`);
  console.log(`   Total unclassified messages: ${totalUnclassifiedMessages}`);

  if (usersWithUnclassifiedMessages > 0) {
    console.log(`\n💡 Solution: Run the populate-users-table.ts script or use /auto command to classify these messages`);
  }
}

findUnclassifiedMessages()
  .then(() => {
    console.log("\n✓ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Fatal error:", error);
    process.exit(1);
  });
