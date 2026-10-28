/**
 * Long-polling entry point, for local development under Bun. Production runs
 * on Cloudflare Workers (worker.ts).
 *
 * Note: bot.start() deletes the bot's webhook, so running this against the
 * production bot token takes the Worker offline until the webhook is set again
 * (bun run webhook:set).
 */
import { InputFile } from "grammy";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexClient, api } from "@halakabot/db";
import { loadConfig } from "./config/environment";
import { ALLOWED_UPDATES, createBotApp } from "./bot";
import { configureMenuButton } from "./handlers/webApp.handler";
import { registerChannelFromChat } from "./services/channel-registry.service";

const REGISTRATION_CLOSED_IMAGE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "assets",
  "registration-closed.jpeg"
);

const config = loadConfig(process.env);
const app = createBotApp(config, {
  registrationClosedPhoto: () => new InputFile(REGISTRATION_CLOSED_IMAGE_PATH),
});
const { bot, convex, adminSyncService, botTaskService } = app;

// Watch the task queue over a Convex subscription. The Worker is notified by
// Convex instead (see convex/botTaskQueue.ts); both claim tasks the same way,
// so they can run side by side without processing a task twice.
const reactiveConvex = new ConvexClient(config.convexUrl);
let draining = false;
let drainAgain = false;

async function drainTasks() {
  if (draining) {
    // A task arrived mid-drain; go round once more when the current pass ends.
    drainAgain = true;
    return;
  }
  draining = true;
  try {
    do {
      drainAgain = false;
      await botTaskService.drain();
    } while (drainAgain);
  } catch (error) {
    console.error("Error processing bot tasks:", error);
  } finally {
    draining = false;
  }
}

const unsubscribe = reactiveConvex.onUpdate(api.queries.getPendingBotTasks, {}, (tasks) => {
  if (tasks && tasks.length > 0) void drainTasks();
});

console.log("Starting bot...");
bot.start({
  allowed_updates: [...ALLOWED_UPDATES],
  drop_pending_updates: true,
  onStart: async (botInfo) => {
    console.log(`Bot @${botInfo.username} is running!`);
    console.log("Listening for reactions and channel posts...");

    await configureMenuButton(bot.api, config.webAppUrl);

    // Seed the configured channel before starting admin sync so the registry
    // is populated immediately on start.
    await registerChannelFromChat(bot.api, convex, config.channelId);

    // The configured channelId is passed as a fallback so it's synced even
    // before any channel has been auto-discovered into the registry.
    console.log(`🔄 Starting admin sync (seed channel ${config.channelId})...`);
    adminSyncService.startPeriodicSync([config.channelId]);
  },
});

const shutdown = async () => {
  console.log("\nStopping bot...");
  adminSyncService.stopPeriodicSync();
  unsubscribe();
  await reactiveConvex.close();
  bot.stop();
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
