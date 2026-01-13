import { Bot } from "grammy";
import { loadConfig } from "./config/environment";
import { ConvexHttpClient, ConvexClient } from "@halakabot/db";
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
const botTaskService = new BotTaskService(bot, convex, reactiveConvex);
botTaskService.start();

// Handle errors
bot.catch((err) => {
  console.error("Bot error:", err);
});

// Start the bot
console.log("Starting bot...");
bot.start({
  allowed_updates: ["message", "message_reaction", "channel_post"],
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} is running!`);
    console.log("Listening for reactions and channel posts...");

    // Start admin sync service
    console.log(`🔄 Starting admin sync for channel ${config.channelId}...`);
    adminSyncService.startPeriodicSync(config.channelId);
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
