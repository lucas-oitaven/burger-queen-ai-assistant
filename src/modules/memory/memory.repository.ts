import type Database from "better-sqlite3";
import {
  isFactCategory,
  isFactStatus,
  type CreateUserFactInput,
  type FactCategory,
  type FactStatus,
  type UserFact,
} from "./memory.types.js";

type UserFactRow = {
  id: number;
  user_id: string;
  fact: string;
  normalized_fact: string | null;
  category: string | null;
  confidence: number;
  source_message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapCategory(value: string | null): FactCategory | null {
  if (value && isFactCategory(value)) {
    return value;
  }
  return null;
}

function mapStatus(value: string): FactStatus {
  if (isFactStatus(value)) {
    return value;
  }
  return "active";
}

function mapUserFact(row: UserFactRow): UserFact {
  return {
    id: row.id,
    userId: row.user_id,
    fact: row.fact,
    normalizedFact: row.normalized_fact,
    category: mapCategory(row.category),
    confidence: row.confidence,
    sourceMessage: row.source_message,
    status: mapStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS = `
  id, user_id, fact, normalized_fact, category, confidence,
  source_message, status, created_at, updated_at
`;

export class MemoryRepository {
  constructor(private readonly db: Database.Database) {}

  findActiveByUserId(userId: string): UserFact[] {
    const rows = this.db
      .prepare(
        `SELECT ${SELECT_COLUMNS}
         FROM user_facts
         WHERE user_id = ? AND status = 'active'
         ORDER BY created_at ASC, id ASC`,
      )
      .all(userId) as UserFactRow[];

    return rows.map(mapUserFact);
  }

  /**
   * Verifica se já existe fato ativo com o mesmo texto normalizado para o usuário.
   */
  existsByNormalizedFact(userId: string, normalizedFact: string): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 AS found
         FROM user_facts
         WHERE user_id = ? AND normalized_fact = ? AND status = 'active'
         LIMIT 1`,
      )
      .get(userId, normalizedFact) as { found: number } | undefined;

    return row !== undefined;
  }

  create(input: CreateUserFactInput): UserFact {
    const status = input.status ?? "active";

    const result = this.db
      .prepare(
        `INSERT INTO user_facts (
           user_id, fact, normalized_fact, category, confidence,
           source_message, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.userId,
        input.fact,
        input.normalizedFact,
        input.category,
        input.confidence,
        input.sourceMessage,
        status,
      );

    const row = this.db
      .prepare(
        `SELECT ${SELECT_COLUMNS}
         FROM user_facts WHERE id = ?`,
      )
      .get(result.lastInsertRowid) as UserFactRow;

    return mapUserFact(row);
  }

  countActiveByUserId(userId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM user_facts
         WHERE user_id = ? AND status = 'active'`,
      )
      .get(userId) as { total: number };

    return row.total;
  }
}
