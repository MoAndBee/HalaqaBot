import { Database } from "bun:sqlite";
import type { User } from "./types";

export class StorageService {
  private db: Database;

  constructor(dbPath: string = "data/bot.sqlite") {
    this.db = new Database(dbPath, { create: true });
    this.initializeDatabase();
  }

  private initializeDatabase() {
    // Create tables for storing data per chat
    this.db.run(`
      CREATE TABLE IF NOT EXISTS message_authors (
        chat_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        message_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        first_name TEXT NOT NULL,
        username TEXT,
        message_text TEXT,
        PRIMARY KEY (chat_id, post_id, message_id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS user_lists (
        chat_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        first_name TEXT NOT NULL,
        username TEXT,
        position INTEGER NOT NULL,
        PRIMARY KEY (chat_id, post_id, user_id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS last_list_messages (
        chat_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        message_id INTEGER NOT NULL,
        PRIMARY KEY (chat_id, post_id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS message_classifications (
        chat_id INTEGER NOT NULL,
        post_id INTEGER NOT NULL,
        message_id INTEGER NOT NULL,
        contains_name INTEGER NOT NULL,
        detected_names TEXT,
        classified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (chat_id, post_id, message_id)
      )
    `);

    // Create indexes for faster lookups
    this.db.run(
      "CREATE INDEX IF NOT EXISTS idx_message_authors_chat_post ON message_authors(chat_id, post_id)",
    );
    this.db.run(
      "CREATE INDEX IF NOT EXISTS idx_user_lists_chat_post ON user_lists(chat_id, post_id)",
    );
    this.db.run(
      "CREATE INDEX IF NOT EXISTS idx_classifications_chat_post ON message_classifications(chat_id, post_id)",
    );
  }

  // Message Authors
  addMessageAuthor(chatId: number, postId: number, messageId: number, user: User, messageText?: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO message_authors (chat_id, post_id, message_id, user_id, first_name, username, message_text)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      chatId,
      postId,
      messageId,
      user.id,
      user.first_name,
      user.username || null,
      messageText || null,
    );
  }

  getMessageAuthor(chatId: number, postId: number, messageId: number): User | null {
    const stmt = this.db.prepare(`
      SELECT user_id, first_name, username
      FROM message_authors
      WHERE chat_id = ? AND post_id = ? AND message_id = ?
    `);
    const row = stmt.get(chatId, postId, messageId) as any;

    if (!row) return null;

    return {
      id: row.user_id,
      first_name: row.first_name,
      username: row.username,
    };
  }

  getPostIdForMessage(chatId: number, messageId: number): number | null {
    const stmt = this.db.prepare(`
      SELECT post_id
      FROM message_authors
      WHERE chat_id = ? AND message_id = ?
      LIMIT 1
    `);
    const row = stmt.get(chatId, messageId) as any;

    return row ? row.post_id : null;
  }

  // User Lists
  addUserToList(chatId: number, postId: number, user: User): boolean {
    // Check if user already exists
    const existingStmt = this.db.prepare(`
      SELECT user_id FROM user_lists WHERE chat_id = ? AND post_id = ? AND user_id = ?
    `);
    const existing = existingStmt.get(chatId, postId, user.id);

    if (existing) {
      return false; // User already in list, no change
    }

    // Get the next position
    const posStmt = this.db.prepare(`
      SELECT COALESCE(MAX(position), 0) + 1 as next_pos
      FROM user_lists
      WHERE chat_id = ? AND post_id = ?
    `);
    const { next_pos } = posStmt.get(chatId, postId) as any;

    // Add user to list
    const insertStmt = this.db.prepare(`
      INSERT INTO user_lists (chat_id, post_id, user_id, first_name, username, position)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(
      chatId,
      postId,
      user.id,
      user.first_name,
      user.username || null,
      next_pos,
    );

    return true; // List changed
  }

  getUserList(chatId: number, postId: number): User[] {
    const stmt = this.db.prepare(`
      SELECT user_id, first_name, username
      FROM user_lists
      WHERE chat_id = ? AND post_id = ?
      ORDER BY position ASC
    `);
    const rows = stmt.all(chatId, postId) as any[];

    return rows.map((row) => ({
      id: row.user_id,
      first_name: row.first_name,
      username: row.username,
    }));
  }

  clearUserList(chatId: number, postId: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM user_lists WHERE chat_id = ? AND post_id = ?
    `);
    stmt.run(chatId, postId);
  }

  // Last List Messages
  setLastListMessage(chatId: number, postId: number, messageId: number): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO last_list_messages (chat_id, post_id, message_id)
      VALUES (?, ?, ?)
    `);
    stmt.run(chatId, postId, messageId);
  }

  getLastListMessage(chatId: number, postId: number): number | null {
    const stmt = this.db.prepare(`
      SELECT message_id FROM last_list_messages WHERE chat_id = ? AND post_id = ?
    `);
    const row = stmt.get(chatId, postId) as any;

    return row ? row.message_id : null;
  }

  clearLastListMessage(chatId: number, postId: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM last_list_messages WHERE chat_id = ? AND post_id = ?
    `);
    stmt.run(chatId, postId);
  }

  // Message Classifications
  storeClassification(
    chatId: number,
    postId: number,
    messageId: number,
    containsName: boolean,
    detectedNames: string[]
  ): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO message_classifications (chat_id, post_id, message_id, contains_name, detected_names)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      chatId,
      postId,
      messageId,
      containsName ? 1 : 0,
      JSON.stringify(detectedNames)
    );
  }

  getClassification(
    chatId: number,
    postId: number,
    messageId: number
  ): { containsName: boolean; detectedNames: string[] } | null {
    const stmt = this.db.prepare(`
      SELECT contains_name, detected_names
      FROM message_classifications
      WHERE chat_id = ? AND post_id = ? AND message_id = ?
    `);
    const row = stmt.get(chatId, postId, messageId) as any;

    if (!row) return null;

    return {
      containsName: row.contains_name === 1,
      detectedNames: JSON.parse(row.detected_names || "[]"),
    };
  }

  getUnclassifiedMessages(chatId: number, postId: number): Array<{
    messageId: number;
    text: string;
    user: User;
  }> {
    const stmt = this.db.prepare(`
      SELECT DISTINCT ma.message_id, ma.user_id, ma.first_name, ma.username, ma.message_text
      FROM message_authors ma
      WHERE ma.chat_id = ?
        AND ma.post_id = ?
        AND ma.user_id NOT IN (
          SELECT user_id
          FROM user_lists
          WHERE chat_id = ? AND post_id = ?
        )
        AND ma.message_id NOT IN (
          SELECT message_id
          FROM message_classifications
          WHERE chat_id = ? AND post_id = ?
        )
      ORDER BY ma.message_id ASC
    `);
    const rows = stmt.all(chatId, postId, chatId, postId, chatId, postId) as any[];

    return rows.map((row) => ({
      messageId: row.message_id,
      text: row.message_text || "",
      user: {
        id: row.user_id,
        first_name: row.first_name,
        username: row.username,
      },
    }));
  }

  // Posts
  getAllPosts(): Array<{ chatId: number; postId: number; userCount: number }> {
    const stmt = this.db.prepare(`
      SELECT DISTINCT 
        ul.chat_id,
        ul.post_id,
        COUNT(ul.user_id) as user_count
      FROM user_lists ul
      GROUP BY ul.chat_id, ul.post_id
      ORDER BY ul.chat_id, ul.post_id DESC
    `);
    const rows = stmt.all() as any[];

    return rows.map((row) => ({
      chatId: row.chat_id,
      postId: row.post_id,
      userCount: row.user_count,
    }));
  }

  updateUserPosition(chatId: number, postId: number, userId: number, newPosition: number): void {
    // Get current position
    const currentStmt = this.db.prepare(`
      SELECT position FROM user_lists WHERE chat_id = ? AND post_id = ? AND user_id = ?
    `);
    const currentRow = currentStmt.get(chatId, postId, userId) as any;

    if (!currentRow) {
      throw new Error(`User ${userId} not found in list for chat ${chatId}, post ${postId}`);
    }

    const currentPosition = currentRow.position;

    if (currentPosition === newPosition) {
      return; // No change needed
    }

    // Use a transaction to ensure consistency
    this.db.run("BEGIN TRANSACTION");

    try {
      if (newPosition < currentPosition) {
        // Moving up: shift users down between newPosition and currentPosition
        const shiftStmt = this.db.prepare(`
          UPDATE user_lists 
          SET position = position + 1 
          WHERE chat_id = ? AND post_id = ? AND position >= ? AND position < ? AND user_id != ?
        `);
        shiftStmt.run(chatId, postId, newPosition, currentPosition, userId);
      } else {
        // Moving down: shift users up between currentPosition and newPosition
        const shiftStmt = this.db.prepare(`
          UPDATE user_lists 
          SET position = position - 1 
          WHERE chat_id = ? AND post_id = ? AND position > ? AND position <= ? AND user_id != ?
        `);
        shiftStmt.run(chatId, postId, currentPosition, newPosition, userId);
      }

      // Update the user's position
      const updateStmt = this.db.prepare(`
        UPDATE user_lists 
        SET position = ? 
        WHERE chat_id = ? AND post_id = ? AND user_id = ?
      `);
      updateStmt.run(newPosition, chatId, postId, userId);

      this.db.run("COMMIT");
    } catch (error) {
      this.db.run("ROLLBACK");
      throw error;
    }
  }

  getPostDetails(chatId: number, postId: number): { userCount: number; messageCount: number } | null {
    const userCountStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM user_lists WHERE chat_id = ? AND post_id = ?
    `);
    const userCountRow = userCountStmt.get(chatId, postId) as any;

    const messageCountStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM message_authors WHERE chat_id = ? AND post_id = ?
    `);
    const messageCountRow = messageCountStmt.get(chatId, postId) as any;

    if (!userCountRow || userCountRow.count === 0) {
      return null;
    }

    return {
      userCount: userCountRow.count,
      messageCount: messageCountRow.count,
    };
  }

  close(): void {
    this.db.close();
  }
}
