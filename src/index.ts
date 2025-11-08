import { Bot } from "grammy";
import { loadConfig } from "./config/environment";
import { StorageService } from "./services/storage.service";
import { MessageService } from "./services/message.service";
import { UserListService } from "./services/user-list.service";
import { ClassificationService } from "./services/classification.service";
import { registerMessageHandler } from "./handlers/message.handler";
import { registerReactionHandler } from "./handlers/reaction.handler";
import { registerAutoClassifyHandler } from "./handlers/auto-classify.handler";

// Load and validate configuration
const config = loadConfig();

// Initialize services
const storage = new StorageService("data/bot.sqlite");
const messageService = new MessageService(storage, config.forwardChatId);
const userListService = new UserListService(storage);
const classificationService = new ClassificationService();

// Create bot instance
const bot = new Bot(config.botToken);

// Register event handlers
registerReactionHandler(bot, messageService, userListService, storage);
registerAutoClassifyHandler(bot, classificationService, messageService, userListService, storage, config);
registerMessageHandler(bot, messageService, storage);

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
const shutdown = () => {
  console.log("\nStopping bot...");
  storage.close();
  bot.stop();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
