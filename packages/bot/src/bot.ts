import { Bot, type InputFile } from "grammy";
import { ConvexHttpClient } from "@halakabot/db";
import type { Config } from "./config/environment";
import { MessageService } from "./services/message.service";
import { UserListService } from "./services/user-list.service";
import { ClassificationService } from "./services/classification.service";
import { BotActionsService } from "./services/bot-actions.service";
import { AdminSyncService } from "./services/admin-sync.service";
import { registerMessageHandler } from "./handlers/message.handler";
import { registerReactionHandler } from "./handlers/reaction.handler";
import { registerAutoClassifyHandler } from "./handlers/auto-classify.handler";
import { registerWebAppHandler } from "./handlers/webApp.handler";
import { registerChatMemberHandler } from "./handlers/chatMember.handler";
import { registerChannelDiscoveryHandler } from "./handlers/channelDiscovery.handler";
import { registerChannelFromChat } from "./services/channel-registry.service";

/**
 * Update types the bot handles, registered with Telegram by scripts/set-webhook.ts.
 * Changing this list only takes effect after re-running that script.
 */
export const ALLOWED_UPDATES = [
  "message",
  "message_reaction",
  "channel_post",
  "my_chat_member",
  "chat_member",
] as const;

export interface BotApp {
  bot: Bot;
  convex: ConvexHttpClient;
  config: Config;
  adminSyncService: AdminSyncService;
  botActions: BotActionsService;
}

export interface BotAppOptions {
  registrationClosedPhoto: () => InputFile;
}

/** Builds the bot with all handlers and services wired up. */
export function createBotApp(config: Config, options: BotAppOptions): BotApp {
  const convex = new ConvexHttpClient(config.convexUrl);
  const bot = new Bot(config.botToken);

  const messageService = new MessageService(convex, config.forwardChatId);
  const userListService = new UserListService(convex);
  const classificationService = new ClassificationService(config.groqApiKey);
  const adminSyncService = new AdminSyncService(convex, bot.api);
  const botActions = new BotActionsService(
    bot,
    convex,
    config,
    messageService,
    classificationService,
    options.registrationClosedPhoto,
  );

  // Channel discovery goes first: it's pass-through middleware that registers
  // unknown channels/discussion groups from any channel post or group message
  // before the other handlers run.
  registerChannelDiscoveryHandler(bot, convex, adminSyncService);
  registerReactionHandler(bot, messageService, userListService, classificationService, convex, config);
  registerAutoClassifyHandler(bot, classificationService, messageService, userListService, convex, config);
  registerMessageHandler(bot, messageService, classificationService, convex);
  registerWebAppHandler(bot, convex, config);
  registerChatMemberHandler(bot, convex, adminSyncService);

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return { bot, convex, config, adminSyncService, botActions };
}

/**
 * Registers the configured channel, then syncs admins for every registered
 * channel. Seeding first means admins aren't locked out of the web app before
 * auto-discovery sees the channel's next post; the configured channel is also
 * passed as a fallback so it's synced even if the registry is still empty.
 */
export async function syncChannels(app: BotApp): Promise<void> {
  await registerChannelFromChat(app.bot.api, app.convex, app.config.channelId);
  await app.adminSyncService.fetchAndSyncAll([app.config.channelId]);
}
