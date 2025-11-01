/**
 * Logging middleware for tracking bot activity
 */

import { Context, NextFunction } from 'grammy';

/**
 * Logger middleware that logs all incoming updates
 */
export async function loggerMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const updateType = ctx.updateType;
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  const userName = ctx.from?.username || ctx.from?.first_name || 'Unknown';

  console.log(
    `🔔 Update: ${updateType} | Chat: ${chatId || 'N/A'} | User: ${userName} (${userId || 'N/A'})`
  );

  await next();
}

/**
 * Simple performance logger
 */
export async function performanceLogger(ctx: Context, next: NextFunction): Promise<void> {
  const start = Date.now();

  await next();

  const duration = Date.now() - start;
  if (duration > 1000) {
    console.warn(`⚠️  Slow operation: ${duration}ms for ${ctx.updateType}`);
  }
}
