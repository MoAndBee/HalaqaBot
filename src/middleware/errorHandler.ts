/**
 * Global error handling middleware
 */

import { Context } from 'grammy';

/**
 * Error handler for the bot
 */
export async function errorHandler(err: any, ctx: Context): Promise<void> {
  const errorMessage = err instanceof Error ? err.message : String(err);

  console.error('❌ Error occurred while processing update:');
  console.error(`Update type: ${ctx.updateType}`);
  console.error(`Chat: ${ctx.chat?.id} (${ctx.chat?.type})`);
  console.error(`User: ${ctx.from?.id} (${ctx.from?.username || ctx.from?.first_name})`);
  console.error(`Error: ${errorMessage}`);

  if (err instanceof Error && err.stack) {
    console.error('Stack trace:', err.stack);
  }

  // Try to notify the user (if possible)
  try {
    if (ctx.chat) {
      await ctx.reply(
        '❌ An error occurred while processing your request. ' +
        'The error has been logged and the bot will continue running.'
      );
    }
  } catch (replyError) {
    // If we can't send a message, just log it
    console.error('Failed to send error message to user:', replyError);
  }
}

/**
 * Wrapper for async handlers to catch errors
 */
export function catchErrors<T extends any[]>(
  handler: (...args: T) => Promise<void>
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await handler(...args);
    } catch (error) {
      console.error('Error in handler:', error);
    }
  };
}
