/**
 * Type definitions for HalakaBot
 */

/**
 * Supported message types in Telegram
 */
export type MessageType =
  | 'text'
  | 'photo'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'sticker'
  | 'animation'
  | 'location'
  | 'contact'
  | 'poll'
  | 'dice'
  | 'video_note'
  | 'new_chat_members'
  | 'left_chat_member'
  | 'new_chat_title'
  | 'new_chat_photo'
  | 'delete_chat_photo'
  | 'group_chat_created'
  | 'supergroup_chat_created'
  | 'channel_chat_created'
  | 'pinned_message'
  | 'unknown';

/**
 * Stored message interface
 */
export interface StoredMessage {
  messageId: number;
  chatId: number;
  chatTitle?: string;
  chatType: 'private' | 'group' | 'supergroup' | 'channel';
  userId: number;
  userName?: string;
  userFirstName?: string;
  userLastName?: string;
  text?: string;
  caption?: string;
  messageType: MessageType;
  date: Date;
  replyToMessageId?: number;
  forwardFrom?: string;
  mediaFileId?: string;
}

/**
 * Message statistics interface
 */
export interface MessageStats {
  totalMessages: number;
  messagesByChat: Map<number, number>;
  messagesByUser: Map<number, number>;
  messagesByType: Map<MessageType, number>;
  oldestMessage?: Date;
  newestMessage?: Date;
  memoryUsageBytes: number;
}

/**
 * Bot configuration interface
 */
export interface BotConfig {
  botToken: string;
  maxStoredMessages?: number;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Command context type helper
 */
export type CommandContext = any; // Will be properly typed with grammY's Context

/**
 * Admin check result
 */
export interface AdminCheckResult {
  isAdmin: boolean;
  isBotAdmin: boolean;
  canReadMessages: boolean;
  errorMessage?: string;
}
