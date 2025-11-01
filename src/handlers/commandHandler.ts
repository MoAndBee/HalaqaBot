/**
 * Command handlers for the bot
 */

import { Context } from 'grammy';
import { messageStore } from '../storage/messageStore';

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${seconds} second${seconds > 1 ? 's' : ''}`;
}

/**
 * /start command - Welcome message
 */
export async function handleStartCommand(ctx: Context): Promise<void> {
  const isGroup = ctx.chat?.type !== 'private';

  await ctx.reply(
    '🤖 *HalakaBot* - Telegram Message Monitor\n\n' +
    '👋 Welcome! I collect and store messages from groups where I\'m an admin.\n\n' +
    (isGroup
      ? '✅ I\'m now monitoring this group!\n\n'
      : '⚠️ Add me to a group and make me an admin to start monitoring.\n\n'
    ) +
    '📋 *Available Commands:*\n' +
    '/help - Show this help message\n' +
    '/stats - View detailed statistics\n' +
    '/count - Show message count for this chat\n' +
    '/clear - Clear stored messages (admin only)\n\n' +
    '💡 *Setup Requirements:*\n' +
    '• Add me as admin to the group\n' +
    '• Disable Privacy Mode via @BotFather\n\n' +
    'Happy monitoring! 🚀',
    { parse_mode: 'Markdown' }
  );
}

/**
 * /help command - Show help message
 */
export async function handleHelpCommand(ctx: Context): Promise<void> {
  await ctx.reply(
    '📚 *HalakaBot Help*\n\n' +
    '*Commands:*\n' +
    '/start - Welcome message and setup info\n' +
    '/help - Show this help message\n' +
    '/stats - View detailed message statistics\n' +
    '/count - Show message count for current chat\n' +
    '/clear - Clear stored messages from memory (admin only)\n\n' +
    '*About:*\n' +
    'HalakaBot monitors and stores messages from groups. All data is stored in memory and will be lost when the bot restarts.\n\n' +
    '*Setup:*\n' +
    '1. Add the bot to your group\n' +
    '2. Make the bot an admin\n' +
    '3. Disable Privacy Mode:\n' +
    '   • Open @BotFather\n' +
    '   • Send /mybots\n' +
    '   • Select your bot\n' +
    '   • Bot Settings → Group Privacy → Turn OFF\n\n' +
    '💡 *Tip:* Use /stats to see detailed analytics about stored messages.',
    { parse_mode: 'Markdown' }
  );
}

/**
 * /stats command - Show detailed statistics
 */
export async function handleStatsCommand(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const isGlobal = ctx.chat?.type === 'private';

  const stats = messageStore.getStats(isGlobal ? undefined : chatId);

  if (stats.totalMessages === 0) {
    await ctx.reply('📊 No messages stored yet. Start chatting and I\'ll collect them!');
    return;
  }

  // Calculate time span
  let timeSpan = '';
  if (stats.oldestMessage && stats.newestMessage) {
    const duration = stats.newestMessage.getTime() - stats.oldestMessage.getTime();
    timeSpan = `\n⏱ *Time Span:* ${formatDuration(duration)}`;
  }

  // Top message types
  const sortedTypes = Array.from(stats.messagesByType.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const typesList = sortedTypes
    .map(([type, count]) => `  • ${type}: ${count}`)
    .join('\n');

  let response = '📊 *Message Statistics*\n\n';
  response += `📝 *Total Messages:* ${stats.totalMessages}\n`;
  response += `💾 *Memory Usage:* ${formatBytes(stats.memoryUsageBytes)}${timeSpan}\n\n`;

  if (isGlobal) {
    response += `💬 *Active Chats:* ${stats.messagesByChat.size}\n`;
    response += `👥 *Unique Users:* ${stats.messagesByUser.size}\n\n`;
  }

  response += `📋 *Top Message Types:*\n${typesList}`;

  await ctx.reply(response, { parse_mode: 'Markdown' });
}

/**
 * /count command - Show message count for current chat
 */
export async function handleCountCommand(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.reply('❌ Unable to determine chat ID.');
    return;
  }

  const count = messageStore.getMessageCount(chatId);
  const chatName = ctx.chat?.type !== 'private' ? ctx.chat?.title : 'this chat';

  await ctx.reply(
    `📊 *Message Count*\n\n` +
    `💬 Messages in ${chatName}: *${count}*\n\n` +
    `Use /stats for detailed statistics.`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * /clear command - Clear stored messages (admin only)
 */
export async function handleClearCommand(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.reply('❌ Unable to determine chat ID.');
    return;
  }

  // Check if user is admin in groups
  if (ctx.chat?.type !== 'private') {
    try {
      const member = await ctx.getChatMember(ctx.from?.id || 0);
      if (member.status !== 'creator' && member.status !== 'administrator') {
        await ctx.reply('❌ This command is only available to group administrators.');
        return;
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      await ctx.reply('❌ Unable to verify admin status.');
      return;
    }
  }

  const count = messageStore.clearMessages(chatId);

  await ctx.reply(
    `🗑 *Messages Cleared*\n\n` +
    `Removed *${count}* message${count !== 1 ? 's' : ''} from memory.\n\n` +
    `The bot will continue collecting new messages.`,
    { parse_mode: 'Markdown' }
  );

  console.log(`🗑 Cleared ${count} messages from chat ${chatId} by user ${ctx.from?.id}`);
}

/**
 * Unknown command handler
 */
export async function handleUnknownCommand(ctx: Context): Promise<void> {
  await ctx.reply(
    '❓ Unknown command. Use /help to see available commands.',
  );
}
