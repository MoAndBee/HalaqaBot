/**
 * HalakaBot - Main entry point
 * Telegram bot using grammY framework to monitor and collect group messages
 */

import { Bot } from 'grammy';
import { config, logConfigSummary } from './config';
import { messageStore } from './storage/messageStore';

// Handlers
import {
  handleMessage,
  handleNewGroup,
  handleLeftMember,
} from './handlers/messageHandler';
import {
  handleStartCommand,
  handleHelpCommand,
  handleStatsCommand,
  handleCountCommand,
  handleClearCommand,
  handleUnknownCommand,
} from './handlers/commandHandler';

// Middleware
import { loggerMiddleware, performanceLogger } from './middleware/logger';
import { adminCheckMiddleware, botAdminCheckMiddleware } from './middleware/adminCheck';
import { errorHandler } from './middleware/errorHandler';

/**
 * Initialize the bot
 */
function initBot(): Bot {
  console.log('🤖 Initializing HalakaBot...\n');

  // Show configuration
  logConfigSummary();
  console.log('');

  // Create bot instance
  const bot = new Bot(config.botToken);

  // Register error handler
  bot.catch(errorHandler);

  // Register middleware
  if (config.enableLogging) {
    bot.use(loggerMiddleware);
    bot.use(performanceLogger);
  }
  bot.use(adminCheckMiddleware);
  bot.use(botAdminCheckMiddleware);

  // Register command handlers
  bot.command('start', handleStartCommand);
  bot.command('help', handleHelpCommand);
  bot.command('stats', handleStatsCommand);
  bot.command('count', handleCountCommand);
  bot.command('clear', handleClearCommand);

  // Handle unknown commands
  bot.on('message:text', async (ctx, next) => {
    // Check if it's a command (starts with /)
    if (ctx.message.text.startsWith('/')) {
      const knownCommands = ['start', 'help', 'stats', 'count', 'clear'];
      const command = ctx.message.text.split(' ')[0].substring(1).split('@')[0];

      if (!knownCommands.includes(command)) {
        await handleUnknownCommand(ctx);
        return;
      }
    }
    await next();
  });

  // Handle new chat members (including bot being added)
  bot.on('message:new_chat_members', async (ctx, next) => {
    const botInfo = await ctx.api.getMe();
    const newMembers = ctx.message.new_chat_members || [];

    if (newMembers.some(member => member.id === botInfo.id)) {
      await handleNewGroup(ctx);
    }
    await next();
  });

  // Handle bot being removed from group
  bot.on('message:left_chat_member', handleLeftMember);

  // Handle all messages (store them)
  bot.on('message', handleMessage);

  // Handle channel posts
  bot.on('channel_post', handleMessage);

  // Handle edited messages
  bot.on('edited_message', async (ctx) => {
    console.log('✏️  Message edited:', ctx.editedMessage?.message_id);
    // Optionally handle edited messages
  });

  return bot;
}

/**
 * Start the bot
 */
async function start(): Promise<void> {
  const bot = initBot();

  console.log('🚀 Starting bot...\n');

  try {
    // Get bot info
    const botInfo = await bot.api.getMe();
    console.log(`✅ Bot started successfully!`);
    console.log(`   Bot username: @${botInfo.username}`);
    console.log(`   Bot ID: ${botInfo.id}`);
    console.log(`   Bot name: ${botInfo.first_name}\n`);

    // Log initial stats
    const stats = messageStore.getStats();
    console.log(`📊 Initial storage stats:`);
    console.log(`   Messages: ${stats.totalMessages}`);
    console.log(`   Active chats: ${stats.messagesByChat.size}\n`);

    console.log('👂 Listening for messages...\n');

    // Start polling
    await bot.start({
      onStart: () => {
        console.log('🎯 Bot is now running and polling for updates!');
      },
    });
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown(bot: Bot): void {
  const shutdown = async (signal: string) => {
    console.log(`\n\n🛑 Received ${signal}, shutting down gracefully...`);

    try {
      // Stop the bot
      await bot.stop();

      // Log final stats
      const stats = messageStore.getStats();
      console.log('\n📊 Final statistics:');
      console.log(`   Total messages collected: ${stats.totalMessages}`);
      console.log(`   Active chats: ${stats.messagesByChat.size}`);
      console.log(`   Unique users: ${stats.messagesByUser.size}`);

      console.log('\n👋 Bot stopped successfully!');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * Main execution
 */
if (import.meta.main) {
  const bot = initBot();
  setupGracefulShutdown(bot);
  start();
}

export { initBot, start };
