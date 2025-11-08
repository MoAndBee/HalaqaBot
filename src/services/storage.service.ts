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
        message_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        first_name TEXT NOT NULL,
        username TEXT,
        PRIMARY KEY (chat_id, message_id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS user_lists (
        chat_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        first_name TEXT NOT NULL,
        username TEXT,
        position INTEGER NOT NULL,
        PRIMARY KEY (chat_id, user_id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS last_list_messages (
        chat_id INTEGER PRIMARY KEY,
        message_id INTEGER NOT NULL
      )
    `);

    // Create indexes for faster lookups
    this.db.run(
      "CREATE INDEX IF NOT EXISTS idx_message_authors_chat ON message_authors(chat_id)",
    );
    this.db.run(
      "CREATE INDEX IF NOT EXISTS idx_user_lists_chat ON user_lists(chat_id)",
    );
  }

  // Message Authors
  addMessageAuthor(chatId: number, messageId: number, user: User): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO message_authors (chat_id, message_id, user_id, first_name, username)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      chatId,
      messageId,
      user.id,
      user.first_name,
      user.username || null,
    );
  }

  getMessageAuthor(chatId: number, messageId: number): User | null {
    const stmt = this.db.prepare(`
      SELECT user_id, first_name, username
      FROM message_authors
      WHERE chat_id = ? AND message_id = ?
    `);
    const row = stmt.get(chatId, messageId) as any;

    if (!row) return null;

    return {
      id: row.user_id,
      first_name: row.first_name,
      username: row.username,
    };
  }

  // User Lists
  addUserToList(chatId: number, user: User): boolean {
    // Check if user already exists
    const existingStmt = this.db.prepare(`
      SELECT user_id FROM user_lists WHERE chat_id = ? AND user_id = ?
    `);
    const existing = existingStmt.get(chatId, user.id);

    if (existing) {
      return false; // User already in list, no change
    }

    // Get the next position
    const posStmt = this.db.prepare(`
      SELECT COALESCE(MAX(position), 0) + 1 as next_pos
      FROM user_lists
      WHERE chat_id = ?
    `);
    const { next_pos } = posStmt.get(chatId) as any;

    // Add user to list
    const insertStmt = this.db.prepare(`
      INSERT INTO user_lists (chat_id, user_id, first_name, username, position)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertStmt.run(
      chatId,
      user.id,
      user.first_name,
      user.username || null,
      next_pos,
    );

    return true; // List changed
  }

  getUserList(chatId: number): User[] {
    const stmt = this.db.prepare(`
      SELECT user_id, first_name, username
      FROM user_lists
      WHERE chat_id = ?
      ORDER BY position ASC
    `);
    const rows = stmt.all(chatId) as any[];

    return rows.map((row) => ({
      id: row.user_id,
      first_name: row.first_name,
      username: row.username,
    }));
  }

  clearUserList(chatId: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM user_lists WHERE chat_id = ?
    `);
    stmt.run(chatId);
  }

  // Last List Messages
  setLastListMessage(chatId: number, messageId: number): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO last_list_messages (chat_id, message_id)
      VALUES (?, ?)
    `);
    stmt.run(chatId, messageId);
  }

  getLastListMessage(chatId: number): number | null {
    const stmt = this.db.prepare(`
      SELECT message_id FROM last_list_messages WHERE chat_id = ?
    `);
    const row = stmt.get(chatId) as any;

    return row ? row.message_id : null;
  }

  clearLastListMessage(chatId: number): void {
    const stmt = this.db.prepare(`
      DELETE FROM last_list_messages WHERE chat_id = ?
    `);
    stmt.run(chatId);
  }

  close(): void {
    this.db.close();
  }
}
