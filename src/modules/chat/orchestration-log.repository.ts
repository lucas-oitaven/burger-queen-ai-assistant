import type Database from "better-sqlite3";
import type {
  CreateOrchestrationLogInput,
  OrchestrationLog,
} from "./orchestration.types.js";

type OrchestrationLogRow = {
  id: number;
  user_id: string;
  session_id: string | null;
  message_id: number | null;
  intent: string;
  needs_rag: number;
  needs_user_facts: number;
  should_extract_facts: number;
  retrieved_docs: string | null;
  saved_facts: string | null;
  risk_level: string;
  created_at: string;
};

function parseJsonStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function mapRow(row: OrchestrationLogRow): OrchestrationLog {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    messageId: row.message_id,
    intent: row.intent,
    needsRag: row.needs_rag === 1,
    needsUserFacts: row.needs_user_facts === 1,
    shouldExtractFacts: row.should_extract_facts === 1,
    retrievedDocs: parseJsonStringArray(row.retrieved_docs),
    savedFacts: parseJsonStringArray(row.saved_facts),
    riskLevel: row.risk_level,
    createdAt: row.created_at,
  };
}

export class OrchestrationLogRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: CreateOrchestrationLogInput): OrchestrationLog {
    const retrievedDocs = JSON.stringify(input.retrievedDocs ?? []);
    const savedFacts = JSON.stringify(input.savedFacts ?? []);

    const result = this.db
      .prepare(
        `INSERT INTO orchestration_logs (
           user_id, session_id, message_id, intent,
           needs_rag, needs_user_facts, should_extract_facts,
           retrieved_docs, saved_facts, risk_level
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.userId,
        input.sessionId ?? null,
        input.messageId,
        input.intent,
        input.needsRag ? 1 : 0,
        input.needsUserFacts ? 1 : 0,
        input.shouldExtractFacts ? 1 : 0,
        retrievedDocs,
        savedFacts,
        input.riskLevel,
      );

    const row = this.db
      .prepare(
        `SELECT id, user_id, session_id, message_id, intent,
                needs_rag, needs_user_facts, should_extract_facts,
                retrieved_docs, saved_facts, risk_level, created_at
         FROM orchestration_logs WHERE id = ?`,
      )
      .get(result.lastInsertRowid) as OrchestrationLogRow;

    return mapRow(row);
  }

  findByUserId(userId: string, limit = 20): OrchestrationLog[] {
    const rows = this.db
      .prepare(
        `SELECT id, user_id, session_id, message_id, intent,
                needs_rag, needs_user_facts, should_extract_facts,
                retrieved_docs, saved_facts, risk_level, created_at
         FROM orchestration_logs
         WHERE user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(userId, limit) as OrchestrationLogRow[];

    return rows.map(mapRow).reverse();
  }
}
