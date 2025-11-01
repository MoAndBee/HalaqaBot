/**
 * Admin verification middleware
 */

import { Context, NextFunction } from 'grammy';

/**
 * Middleware to check if the user is an admin in the chat
 * Attaches isAdmin property to ctx for use in handlers
 */
export async function adminCheckMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  // Add isAdmin flag to context
  (ctx as any).isAdmin = false;

  // Only check in groups
  if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
    try {
      const userId = ctx.from?.id;
      if (userId) {
        const member = await ctx.getChatMember(userId);
        (ctx as any).isAdmin = member.status === 'creator' || member.status === 'administrator';
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  } else if (ctx.chat?.type === 'private') {
    // In private chats, user is always "admin"
    (ctx as any).isAdmin = true;
  }

  await next();
}

/**
 * Middleware to check if bot is admin in the chat
 */
export async function botAdminCheckMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  // Add isBotAdmin flag to context
  (ctx as any).isBotAdmin = false;

  if (ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup') {
    try {
      const botInfo = await ctx.api.getMe();
      const botMember = await ctx.getChatMember(botInfo.id);
      (ctx as any).isBotAdmin = botMember.status === 'administrator';

      // Warn if bot is not admin
      if (!((ctx as any).isBotAdmin)) {
        console.warn(`⚠️  Bot is not admin in chat ${ctx.chat.title || ctx.chat.id}`);
      }
    } catch (error) {
      console.error('Error checking bot admin status:', error);
    }
  }

  await next();
}
