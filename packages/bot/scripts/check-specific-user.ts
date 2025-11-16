import { ConvexHttpClient } from "convex/browser";
import { api } from "@halakabot/db";

const CONVEX_URL = process.env.CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error("Missing CONVEX_URL environment variable");
}

const convex = new ConvexHttpClient(CONVEX_URL);

async function checkSpecificUser(userId: number) {
  console.log(`\n🔍 Investigating user ${userId}...\n`);
  console.log("=" .repeat(80));

  // Get user info
  const user = await convex.query(api.queries.getUser, { userId });

  if (!user) {
    console.log(`❌ User ${userId} not found in users table`);
    return;
  }

  console.log(`\n👤 User Info:`);
  console.log(`   User ID: ${user.userId}`);
  console.log(`   Telegram name: ${user.telegramName}`);
  console.log(`   Username: ${user.username || "N/A"}`);
  console.log(`   Real name: ${user.realName || "NOT SET"}`);
  console.log(`   Source message: ${user.sourceMessageText || "N/A"}`);

  // Get all messages from this user
  const messages = await convex.query(api.queries.getMessagesByUserId, { userId });

  console.log(`\n📨 Messages from this user: ${messages.length}`);

  if (messages.length === 0) {
    console.log(`   No messages found`);
    return;
  }

  // Check each message
  for (const message of messages) {
    console.log(`\n   📝 Message ${message.messageId}:`);
    console.log(`      Chat ID: ${message.chatId}, Post ID: ${message.postId}`);
    console.log(`      Text: "${message.messageText || "NO TEXT"}"`);

    // Check if this message has been classified
    const classification = await convex.query(api.queries.getClassification, {
      chatId: message.chatId,
      postId: message.postId,
      messageId: message.messageId,
    });

    if (classification) {
      console.log(`      ✅ Classification found:`);
      console.log(`         Contains name: ${classification.containsName}`);
      console.log(`         Detected names: [${classification.detectedNames.join(', ')}]`);

      if (classification.containsName && classification.detectedNames.length > 0) {
        console.log(`      ⚠️  ISSUE: Message has names but user realName is not set!`);
      }
    } else {
      console.log(`      ❌ No classification found for this message`);
    }
  }

  console.log("\n" + "=".repeat(80));
}

// Get userId from command line argument
const userId = process.argv[2] ? parseInt(process.argv[2]) : 6181119649;

console.log(`Checking user ${userId}...`);

checkSpecificUser(userId)
  .then(() => {
    console.log("\n✓ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Fatal error:", error);
    process.exit(1);
  });
