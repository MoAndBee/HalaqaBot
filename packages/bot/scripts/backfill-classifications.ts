import { ConvexHttpClient } from "convex/browser";
import { api } from "@halakabot/db";
import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";

const CONVEX_URL = process.env.CONVEX_URL;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!CONVEX_URL || !GROQ_API_KEY) {
  throw new Error("Missing CONVEX_URL or GROQ_API_KEY environment variables");
}

const convex = new ConvexHttpClient(CONVEX_URL);

async function detectNamesInMessage(messageText: string): Promise<string[]> {
  try {
    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      prompt: `Analyze this Arabic message and extract ONLY the person's name(s).

Rules:
- Extract only the actual person names (first, middle, last names)
- Do NOT include words like "تلاوة", "تسميع", "تصحيح", "ام" (unless part of the name like "أم ساره")
- Return ONLY the names, separated by commas if there are multiple
- If NO name is found, return "NONE"

Message: "${messageText}"

Names:`,
    });

    const cleanedText = text.trim();

    if (cleanedText === "NONE" || cleanedText === "" || cleanedText.toLowerCase() === "none") {
      return [];
    }

    // Split by comma or newline and clean up
    const names = cleanedText
      .split(/[,\n]/)
      .map(name => name.trim())
      .filter(name => name.length > 0 && name !== "NONE");

    return names;
  } catch (error) {
    console.error("Error detecting names:", error);
    return [];
  }
}

async function backfillClassifications() {
  console.log("🔄 Backfilling classifications for existing messages...\n");

  // Get all users without realNames
  const allUsers = await convex.query(api.queries.getAllUsers, {});
  const usersWithoutRealName = allUsers.filter(u => !u.realName);

  console.log(`Users without realName: ${usersWithoutRealName.length}\n`);
  console.log("=" .repeat(80));

  let processed = 0;
  let classified = 0;
  let namesFound = 0;
  let errors = 0;

  for (const user of usersWithoutRealName) {
    console.log(`\n👤 User ${user.userId} (${user.telegramName})`);

    // Get messages from this user
    const messages = await convex.query(api.queries.getMessagesByUserId, {
      userId: user.userId,
    });

    console.log(`   Messages: ${messages.length}`);

    for (const message of messages) {
      // Skip if already classified
      const existingClassification = await convex.query(api.queries.getClassification, {
        chatId: message.chatId,
        postId: message.postId,
        messageId: message.messageId,
      });

      if (existingClassification) {
        console.log(`   ⏭️  Message ${message.messageId} already classified`);
        continue;
      }

      // Skip if no text
      if (!message.messageText || !message.messageText.trim()) {
        console.log(`   ⏭️  Message ${message.messageId} has no text`);
        continue;
      }

      processed++;
      console.log(`   🤖 Classifying message ${message.messageId}...`);
      console.log(`      Text: "${message.messageText}"`);

      try {
        // Detect names
        const detectedNames = await detectNamesInMessage(message.messageText);

        const containsName = detectedNames.length > 0;

        console.log(`      Result: ${containsName ? `✅ Found: [${detectedNames.join(', ')}]` : 'ℹ️  No names'}`);

        // Store classification (this will also update user's realName via the mutation)
        await convex.mutation(api.mutations.storeClassification, {
          chatId: message.chatId,
          postId: message.postId,
          messageId: message.messageId,
          containsName: containsName,
          detectedNames: detectedNames,
        });

        classified++;

        if (containsName) {
          namesFound++;
          console.log(`      ✅ Classification stored and realName updated!`);
        }

        // Add delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`      ❌ Error:`, error);
        errors++;
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Backfill complete!");
  console.log(`   Users processed: ${usersWithoutRealName.length}`);
  console.log(`   Messages processed: ${processed}`);
  console.log(`   Messages classified: ${classified}`);
  console.log(`   Names found: ${namesFound}`);
  console.log(`   Errors: ${errors}`);
}

backfillClassifications()
  .then(() => {
    console.log("\n✓ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Fatal error:", error);
    process.exit(1);
  });
