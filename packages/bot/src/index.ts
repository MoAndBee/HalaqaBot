import { Bot } from "grammy"; // trigger redeploy
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
import { registerChatMemberHandler } from "./handlers/chatMember.handler";
import { registerChannelDiscoveryHandler } from "./handlers/channelDiscovery.handler";
import { registerChannelFromChat } from "./services/channel-registry.service";

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

// Register event handlers. Channel discovery goes first: it's pass-through
// middleware that registers unknown channels/discussion groups from any
// channel post or group message before the other handlers run.
registerChannelDiscoveryHandler(bot, convex, adminSyncService);
registerReactionHandler(bot, messageService, userListService, classificationService, convex, config);
registerAutoClassifyHandler(bot, classificationService, messageService, userListService, convex, config);
registerMessageHandler(bot, messageService, classificationService, convex);
registerWebAppHandler(bot, convex, config);
registerChatMemberHandler(bot, convex, adminSyncService);

// Start bot task service with reactive subscriptions
const botTaskService = new BotTaskService(bot, convex, reactiveConvex, config, messageService, classificationService);
botTaskService.start();

// Handle errors
bot.catch((err) => {
  console.error("Bot error:", err);
});

// Ensure the configured channel is registered in the channels registry on
// startup, so admins aren't locked out of the web app before auto-discovery
// fires on the next channel post. Resolves the linked discussion group directly
// from Telegram rather than depending on historical data.
async function seedConfiguredChannel(): Promise<void> {
  await registerChannelFromChat(bot.api, convex, config.channelId);
}

// Start the bot
console.log("Starting bot...");
bot.start({
  allowed_updates: ["message", "message_reaction", "channel_post", "my_chat_member"],
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
