/**
 * In-memory message storage system
 */

import type { StoredMessage, MessageStats, MessageType } from '../types';

/**
 * MessageStore class for managing stored messages
 */
export class MessageStore {
  private messages: StoredMessage[] = [];
  private maxMessages: number;

  constructor(maxMessages: number = 10000) {
    this.maxMessages = maxMessages;
  }

  /**
   * Add a new message to the store
   */
  addMessage(message: StoredMessage): void {
    this.messages.push(message);

    // Implement circular buffer: remove oldest messages if limit exceeded
    if (this.messages.length > this.maxMessages) {
      const excess = this.messages.length - this.maxMessages;
      this.messages.splice(0, excess);
      console.log(`⚠️  Message limit reached. Removed ${excess} oldest message(s).`);
    }
  }

  /**
   * Get all messages, optionally filtered by chatId
   */
  getMessages(chatId?: number): StoredMessage[] {
    if (chatId !== undefined) {
      return this.messages.filter(msg => msg.chatId === chatId);
    }
    return [...this.messages]; // Return a copy to prevent external modifications
  }

  /**
   * Get message count, optionally filtered by chatId
   */
  getMessageCount(chatId?: number): number {
    if (chatId !== undefined) {
      return this.messages.filter(msg => msg.chatId === chatId).length;
    }
    return this.messages.length;
  }

  /**
   * Get messages by user ID
   */
  getMessagesByUser(userId: number, chatId?: number): StoredMessage[] {
    let filtered = this.messages.filter(msg => msg.userId === userId);
    if (chatId !== undefined) {
      filtered = filtered.filter(msg => msg.chatId === chatId);
    }
    return filtered;
  }

  /**
   * Get messages by type
   */
  getMessagesByType(messageType: MessageType, chatId?: number): StoredMessage[] {
    let filtered = this.messages.filter(msg => msg.messageType === messageType);
    if (chatId !== undefined) {
      filtered = filtered.filter(msg => msg.chatId === chatId);
    }
    return filtered;
  }

  /**
   * Clear messages, optionally filtered by chatId
   */
  clearMessages(chatId?: number): number {
    if (chatId !== undefined) {
      const beforeCount = this.messages.length;
      this.messages = this.messages.filter(msg => msg.chatId !== chatId);
      return beforeCount - this.messages.length;
    }
    const count = this.messages.length;
    this.messages = [];
    return count;
  }

  /**
   * Get comprehensive statistics
   */
  getStats(chatId?: number): MessageStats {
    const messages = chatId !== undefined
      ? this.messages.filter(msg => msg.chatId === chatId)
      : this.messages;

    const messagesByChat = new Map<number, number>();
    const messagesByUser = new Map<number, number>();
    const messagesByType = new Map<MessageType, number>();

    let oldestDate: Date | undefined;
    let newestDate: Date | undefined;

    for (const msg of messages) {
      // Count by chat
      messagesByChat.set(msg.chatId, (messagesByChat.get(msg.chatId) || 0) + 1);

      // Count by user
      messagesByUser.set(msg.userId, (messagesByUser.get(msg.userId) || 0) + 1);

      // Count by type
      messagesByType.set(msg.messageType, (messagesByType.get(msg.messageType) || 0) + 1);

      // Track dates
      if (!oldestDate || msg.date < oldestDate) {
        oldestDate = msg.date;
      }
      if (!newestDate || msg.date > newestDate) {
        newestDate = msg.date;
      }
    }

    // Estimate memory usage (rough approximation)
    const memoryUsageBytes = messages.reduce((sum, msg) => {
      let size = 100; // Base object overhead
      size += (msg.text?.length || 0) * 2; // UTF-16 characters
      size += (msg.caption?.length || 0) * 2;
      size += (msg.userName?.length || 0) * 2;
      size += (msg.chatTitle?.length || 0) * 2;
      return sum + size;
    }, 0);

    return {
      totalMessages: messages.length,
      messagesByChat,
      messagesByUser,
      messagesByType,
      oldestMessage: oldestDate,
      newestMessage: newestDate,
      memoryUsageBytes,
    };
  }

  /**
   * Get the most recent N messages
   */
  getRecentMessages(count: number, chatId?: number): StoredMessage[] {
    const messages = chatId !== undefined
      ? this.messages.filter(msg => msg.chatId === chatId)
      : this.messages;

    return messages.slice(-count);
  }

  /**
   * Search messages by text content
   */
  searchMessages(query: string, chatId?: number): StoredMessage[] {
    const lowerQuery = query.toLowerCase();
    let filtered = this.messages.filter(msg =>
      msg.text?.toLowerCase().includes(lowerQuery) ||
      msg.caption?.toLowerCase().includes(lowerQuery)
    );

    if (chatId !== undefined) {
      filtered = filtered.filter(msg => msg.chatId === chatId);
    }

    return filtered;
  }

  /**
   * Get unique chat IDs that have messages
   */
  getActiveChatIds(): number[] {
    const chatIds = new Set<number>();
    for (const msg of this.messages) {
      chatIds.add(msg.chatId);
    }
    return Array.from(chatIds);
  }
}

/**
 * Global message store instance
 */
export const messageStore = new MessageStore();
