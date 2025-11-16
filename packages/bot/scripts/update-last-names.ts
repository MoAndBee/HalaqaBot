import { Bot } from "grammy";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@halakabot/db";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CONVEX_URL = process.env.CONVEX_URL;

if (!BOT_TOKEN || !CONVEX_URL) {
  throw new Error("Missing BOT_TOKEN or CONVEX_URL environment variables");
}

const bot = new Bot(BOT_TOKEN);
const convex = new ConvexHttpClient(CONVEX_URL);

async function updateLastNamesForPost(chatId: number, postId: number) {
  console.log(`\n📝 Fetching users for post ${postId} in chat ${chatId}...`);

  // Get all users from the post
  const result = await convex.query(api.queries.getUserList, {
    chatId,
    postId,
  });

  const allUsers = [...result.activeUsers, ...result.completedUsers];
  console.log(`Found ${allUsers.length} users`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of allUsers) {
    try {
      // Skip if user already has a last name
      if (user.last_name) {
        console.log(`⏭️  Skipping user ${user.id} - already has last name`);
        skipped++;
        continue;
      }

      // Fetch user data from Telegram
      console.log(`🔍 Fetching data for user ${user.id} (${user.first_name})...`);
      const chatMember = await bot.api.getChatMember(chatId, user.id);

      if (chatMember.user.last_name) {
        console.log(
          `✅ Found last name for ${user.first_name}: ${chatMember.user.last_name}`
        );

        // Update the database
        const updateResult = await convex.mutation(
          api.mutations.updateUserLastName,
          {
            userId: user.id,
            lastName: chatMember.user.last_name,
          }
        );

        console.log(
          `   Updated ${updateResult.messageAuthorsUpdated} messageAuthors and ${updateResult.userListsUpdated} userLists records`
        );
        updated++;
      } else {
        console.log(`ℹ️  User ${user.first_name} has no last name on Telegram`);
        skipped++;
      }

      // Add a small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`❌ Error updating user ${user.id}:`, error);
      errors++;
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

// Get post ID from command line argument
const postId = process.argv[2] ? parseInt(process.argv[2]) : 14668;
const chatId = process.argv[3] ? parseInt(process.argv[3]) : undefined;

if (!chatId) {
  console.error("Usage: bun run scripts/update-last-names.ts <postId> <chatId>");
  process.exit(1);
}

updateLastNamesForPost(chatId, postId)
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
