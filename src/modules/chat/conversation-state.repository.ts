import type Database from "better-sqlite3";
import {
  createInitialConversationState,
  type ConversationStage,
  type ConversationState,
  type OrderDraftItem,
} from "./conversation-stage.types.js";

type ConversationStateRow = {
  user_id: string;
  stage: string;
  draft_order_json: string;
  last_suggested_items_json: string;
  completed_orders_count: number;
  updated_at: string;
};

function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function mapRow(row: ConversationStateRow): ConversationState {
  return {
    userId: row.user_id,
    stage: row.stage as ConversationStage,
    draftOrder: parseJsonArray<OrderDraftItem>(row.draft_order_json, []),
    lastSuggestedItems: parseJsonArray<string>(
      row.last_suggested_items_json,
      [],
    ),
    completedOrdersCount: row.completed_orders_count,
    updatedAt: row.updated_at,
  };
}

export class ConversationStateRepository {
  constructor(private readonly db: Database.Database) {}

  findByUserId(userId: string): ConversationState | null {
    const row = this.db
      .prepare(
        `SELECT user_id, stage, draft_order_json, last_suggested_items_json,
                completed_orders_count, updated_at
         FROM conversation_state
         WHERE user_id = ?`,
      )
      .get(userId) as ConversationStateRow | undefined;

    return row ? mapRow(row) : null;
  }

  findOrCreate(userId: string): ConversationState {
    const existing = this.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const initial = createInitialConversationState(userId);
    this.save(initial);
    return initial;
  }

  save(state: ConversationState): ConversationState {
    this.db
      .prepare(
        `INSERT INTO conversation_state (
           user_id, stage, draft_order_json, last_suggested_items_json,
           completed_orders_count, updated_at
         ) VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET
           stage = excluded.stage,
           draft_order_json = excluded.draft_order_json,
           last_suggested_items_json = excluded.last_suggested_items_json,
           completed_orders_count = excluded.completed_orders_count,
           updated_at = datetime('now')`,
      )
      .run(
        state.userId,
        state.stage,
        JSON.stringify(state.draftOrder),
        JSON.stringify(state.lastSuggestedItems),
        state.completedOrdersCount,
      );

    return this.findByUserId(state.userId) ?? state;
  }
}
