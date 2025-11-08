import { Database } from "bun:sqlite";
import type { User } from "../types";

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

    // Create indexes for faster lookups
    this.db.run(
      "CREATE INDEX IF NOT EXISTS idx_message_authors_chat_post ON message_authors(chat_id, post_id)",
    );
    this.db.run(
      "CREATE INDEX IF NOT EXISTS idx_user_lists_chat_post ON user_lists(chat_id, post_id)",
    );
  }

  // Message Authors
  addMessageAuthor(chatId: number, postId: number, messageId: number, user: User): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO message_authors (chat_id, post_id, message_id, user_id, first_name, username)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      chatId,
      postId,
      messageId,
      user.id,
      user.first_name,
      user.username || null,
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

  close(): void {
    this.db.close();
  }
}
