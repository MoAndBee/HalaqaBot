import { Bot } from "grammy"; // trigger redeploy
import { loadConfig } from "./config/environment";
import { ConvexHttpClient, ConvexClient, api } from "@halakabot/db";
import { MessageService } from "./services/message.service";
import { UserListService } from "./services/user-list.service";
import { ClassificationService } from "./services/classification.service";
import { BotTaskService } from "./services/bot-task.service";
import { AdminSyncService } from "./services/admin-sync.service";
import { registerMessageHandler } from "./handlers/message.handler";
import { registerReactionHandler } from "./handlers/reaction.handler";
import { registerAutoClassifyHandler } from "./handlers/auto-classify.handler";
import { registerWebAppHandler } from "./handlers/webApp.handler";

// Load and validate configuration
const config = loadConfig();

// Initialize Convex clients
const convexUrl = process.env.CONVEX_URL || "http://localhost:3210";
const convex = new ConvexHttpClient(convexUrl);
const reactiveConvex = new ConvexClient(convexUrl);

// Create bot instance first (needed for admin sync service)
const bot = new Bot(config.botToken);

// Initialize services
const messageService = new MessageService(convex, config.forwardChatId);
const userListService = new UserListService(convex);
const classificationService = new ClassificationService();
const adminSyncService = new AdminSyncService(convex, bot.api);

// Register event handlers
registerReactionHandler(bot, messageService, userListService, classificationService, convex, config);
registerAutoClassifyHandler(bot, classificationService, messageService, userListService, convex, config);
registerMessageHandler(bot, messageService, classificationService, convex);
registerWebAppHandler(bot, convex, config);

// Start bot task service with reactive subscriptions
const botTaskService = new BotTaskService(bot, convex, reactiveConvex, config);
botTaskService.start();

// Handle errors
bot.catch((err) => {
  console.error("Bot error:", err);
});

// Ensure the configured channel is registered in the channels registry on
// startup, so admins aren't locked out of the web app before auto-discovery
// fires on the next channel post. We resolve the linked discussion group
// (chatId) directly from Telegram rather than depending on historical data.
async function seedConfiguredChannel(): Promise<void> {
  try {
    const chat = await bot.api.getChat(config.channelId);
    const linkedChatId = (chat as { linked_chat_id?: number }).linked_chat_id;
    const chatId = linkedChatId ?? config.channelId;
    const title = (chat as { title?: string }).title;

    if (linkedChatId === undefined) {
      console.warn(
        `⚠️  Channel ${config.channelId} has no linked discussion group; ` +
          `seeding chatId = channelId as a fallback.`,
      );
    }

    await convex.mutation(api.mutations.upsertChannel, {
      channelId: config.channelId,
      chatId,
      title,
    });
    console.log(`✅ Seeded channel ${config.channelId} -> chat ${chatId}`);
  } catch (error) {
    console.error("❌ Error seeding configured channel:", error);
    // Non-fatal: auto-discovery from traffic will still register the channel.
  }
}

// Start the bot
console.log("Starting bot...");
bot.start({
  allowed_updates: ["message", "message_reaction", "channel_post"],
  drop_pending_updates: true,
  onStart: async (botInfo) => {
    console.log(`Bot @${botInfo.username} is running!`);
    console.log("Listening for reactions and channel posts...");

    // Seed the configured channel before starting admin sync so the registry
    // is populated immediately on deploy.
    await seedConfiguredChannel();

    // Start admin sync service across all registered channels. The configured
    // channelId is passed as a fallback so it's synced even before any channel
    // has been auto-discovered into the registry from traffic.
    console.log(`🔄 Starting admin sync (seed channel ${config.channelId})...`);
    adminSyncService.startPeriodicSync([config.channelId]);
  },
});

// Handle graceful shutdown
const shutdown = async () => {
  console.log("\nStopping bot...");
  adminSyncService.stopPeriodicSync();
  botTaskService.stop();
  await reactiveConvex.close();
  bot.stop();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
