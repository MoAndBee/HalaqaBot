import { Bot } from "grammy";
import { loadConfig } from "./config/environment";
import { ConvexHttpClient, ConvexClient } from "@halakabot/db";
import { MessageService } from "./services/message.service";
import { UserListService } from "./services/user-list.service";
import { ClassificationService } from "./services/classification.service";
import { BotTaskService } from "./services/bot-task.service";
import { registerMessageHandler } from "./handlers/message.handler";
import { registerReactionHandler } from "./handlers/reaction.handler";
import { registerAutoClassifyHandler } from "./handlers/auto-classify.handler";

// Load and validate configuration
const config = loadConfig();

// Initialize Convex clients
const convexUrl = process.env.CONVEX_URL || "http://localhost:3210";
const convex = new ConvexHttpClient(convexUrl);
const reactiveConvex = new ConvexClient(convexUrl);

// Initialize services
const messageService = new MessageService(convex, config.forwardChatId);
const userListService = new UserListService(convex);
const classificationService = new ClassificationService();

// Create bot instance
const bot = new Bot(config.botToken);

// Register event handlers
registerReactionHandler(bot, messageService, userListService, classificationService, convex, config);
registerAutoClassifyHandler(bot, classificationService, messageService, userListService, convex, config);
registerMessageHandler(bot, messageService, classificationService, convex);

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
  },
});

// Handle graceful shutdown
const shutdown = async () => {
  console.log("\nStopping bot...");
  botTaskService.stop();
  await reactiveConvex.close();
  bot.stop();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
