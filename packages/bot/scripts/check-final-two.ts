import { ConvexHttpClient } from "convex/browser";
import { api } from "@halakabot/db";

const CONVEX_URL = process.env.CONVEX_URL;

if (!CONVEX_URL) {
  throw new Error("Missing CONVEX_URL environment variable");
}

const convex = new ConvexHttpClient(CONVEX_URL);

async function checkFinalTwo() {
  const userIds = [6033534422, 7961135147];

  for (const userId of userIds) {
    console.log(`\n${"=".repeat(80)}`);
    const user = await convex.query(api.queries.getUser, { userId });
    console.log(`👤 User ${userId}`);
    console.log(`   Telegram name: ${user?.telegramName}`);
    console.log(`   Username: ${user?.username || 'N/A'}`);
    console.log(`   Real name: ${user?.realName || 'NOT SET'}`);

    const messages = await convex.query(api.queries.getMessagesByUserId, { userId });
    console.log(`\n   Messages (${messages.length}):`);

    for (const msg of messages) {
      console.log(`\n   📧 Message ${msg.messageId}:`);
      console.log(`      Text: "${msg.messageText || '[NO TEXT]'}"`);
      console.log(`      Chat: ${msg.chatId}, Post: ${msg.postId}`);

      const classification = await convex.query(api.queries.getClassification, {
        chatId: msg.chatId,
        postId: msg.postId,
        messageId: msg.messageId,
      });

      if (classification) {
        console.log(`      ✅ Classification:`);
        console.log(`         containsName: ${classification.containsName}`);
        console.log(`         detectedNames: [${classification.detectedNames?.join(', ') || 'NONE'}]`);
      } else {
        console.log(`      ❌ Not classified`);
      }
    }
  }

  console.log(`\n${"=".repeat(80)}\n`);
}

checkFinalTwo()
  .then(() => {
    console.log("\n✓ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Fatal error:", error);
    process.exit(1);
  });
