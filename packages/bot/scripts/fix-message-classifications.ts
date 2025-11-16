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

async function detectNamesInMessage(messageText: string): Promise<{ containsName: boolean; names: string[] }> {
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
      return {
        containsName: false,
        names: [],
      };
    }

    // Split by comma or newline and clean up
    const names = cleanedText
      .split(/[,\n]/)
      .map(name => name.trim())
      .filter(name => name.length > 0 && name !== "NONE");

    return {
      containsName: names.length > 0,
      names: names,
    };
  } catch (error) {
    console.error("Error detecting names:", error);
    return {
      containsName: false,
      names: [],
    };
  }
}

async function fixMessageClassifications() {
  console.log("📊 Fetching all message classifications...\n");

  const classifications = await convex.query(api.queries.getAllMessageClassifications, {});
  console.log(`Found ${classifications.length} total classifications\n`);

  // Filter messages that need fixing:
  // 1. Messages marked as containing names but with empty detectedNames array
  // 2. Messages with actual text content
  const needsFixing = classifications.filter(
    (c) => c.containsName &&
           c.detectedNames.length === 0 &&
           c.messageText &&
           c.messageText.trim().length > 0
  );

  console.log(`Found ${needsFixing.length} classifications that need fixing\n`);
  console.log("=" .repeat(60));

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const classification of needsFixing) {
    try {
      console.log(`\n📝 Processing message ${classification.messageId}:`);
      console.log(`   Text: "${classification.messageText}"`);
      console.log(`   Current detectedNames: [${classification.detectedNames.join(", ")}]`);

      // Detect names in the message
      const result = await detectNamesInMessage(classification.messageText!);

      if (result.names.length > 0) {
        console.log(`   ✅ Detected names: [${result.names.join(", ")}]`);

        // Update the classification
        await convex.mutation(api.mutations.storeClassification, {
          chatId: classification.chatId,
          postId: classification.postId,
          messageId: classification.messageId,
          containsName: true,
          detectedNames: result.names,
        });

        updated++;
        console.log(`   ✓ Updated classification`);
      } else {
        console.log(`   ⚠️  No names detected - skipping`);
        skipped++;
      }

      // Add a small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`   ❌ Error processing message ${classification.messageId}:`, error);
      errors++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n✅ Migration complete!");
  console.log(`   Total classifications: ${classifications.length}`);
  console.log(`   Needed fixing: ${needsFixing.length}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

fixMessageClassifications()
  .then(() => {
    console.log("\n✓ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Fatal error:", error);
    process.exit(1);
  });
