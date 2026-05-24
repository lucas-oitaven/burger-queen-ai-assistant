import type Database from "better-sqlite3";
import type { Message, MessageRole } from "./message.types.js";

type MessageRow = {
  id: number;
  user_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
};

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

export class MessageRepository {
  constructor(private readonly db: Database.Database) {}

  create(userId: string, role: MessageRole, content: string): Message {
    const result = this.db
      .prepare(
        `INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)`,
      )
      .run(userId, role, content);

    const row = this.db
      .prepare(
        `SELECT id, user_id, role, content, created_at
         FROM messages WHERE id = ?`,
      )
      .get(result.lastInsertRowid) as MessageRow;

    return mapMessage(row);
  }

  findByUserId(userId: string): Message[] {
    const rows = this.db
      .prepare(
        `SELECT id, user_id, role, content, created_at
         FROM messages
         WHERE user_id = ?
         ORDER BY created_at ASC, id ASC`,
      )
      .all(userId) as MessageRow[];

    return rows.map(mapMessage);
  }

  /**
   * Últimas N mensagens do usuário em ordem cronológica (memória curta).
   */
  findRecentByUserId(userId: string, limit: number): Message[] {
    if (limit <= 0) {
      return [];
    }

    const rows = this.db
      .prepare(
        `SELECT id, user_id, role, content, created_at
         FROM messages
         WHERE user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(userId, limit) as MessageRow[];

    return rows.map(mapMessage).reverse();
  }

  countByUserId(userId: string): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS total FROM messages WHERE user_id = ?`)
      .get(userId) as { total: number };

    return row.total;
  }
}
