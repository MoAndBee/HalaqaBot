/**
 * Configuration loader for HalakaBot
 * Bun automatically loads .env files, so we just need to validate and export
 */

import type { BotConfig } from './types';

/**
 * Load and validate bot configuration from environment variables
 */
function loadConfig(): BotConfig {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN is required. Please set it in your .env file.\n' +
      'You can obtain a token from @BotFather on Telegram.'
    );
  }

  // Validate token format (basic check)
  if (!botToken.includes(':')) {
    throw new Error(
      'Invalid TELEGRAM_BOT_TOKEN format. Token should be in format: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
    );
  }

  const config: BotConfig = {
    botToken,
    maxStoredMessages: parseInt(process.env.MAX_STORED_MESSAGES || '10000', 10),
    enableLogging: process.env.ENABLE_LOGGING !== 'false',
    logLevel: (process.env.LOG_LEVEL as BotConfig['logLevel']) || 'info',
  };

  return config;
}

/**
 * Exported configuration object
 */
export const config = loadConfig();

/**
 * Helper to log configuration (without exposing sensitive data)
 */
export function logConfigSummary(): void {
  console.log('🤖 HalakaBot Configuration:');
  console.log(`   Max stored messages: ${config.maxStoredMessages}`);
  console.log(`   Logging enabled: ${config.enableLogging}`);
  console.log(`   Log level: ${config.logLevel}`);
  console.log(`   Bot token: ${config.botToken.substring(0, 10)}...${config.botToken.slice(-4)}`);
}
