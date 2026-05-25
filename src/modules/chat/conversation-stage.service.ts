import type Database from "better-sqlite3";
import type { IntentClassification } from "../llm/intent.types.js";
import { ConversationStateRepository } from "./conversation-state.repository.js";
import {
  advanceConversationStage,
  extractSuggestedItemsFromAssistantText,
  type StageTransitionInput,
} from "./conversation-stage.detector.js";
import type { ConversationState } from "./conversation-stage.types.js";
import type { ResolvedMenuItem } from "./resolve-menu-items.types.js";

export type PrepareConversationTurnInput = {
  userId: string;
  userMessage: string;
  classification: IntentClassification;
  resolvedMenuItems?: ResolvedMenuItem[];
};

export class ConversationStageService {
  constructor(private readonly repository: ConversationStateRepository) {}

  static fromDatabase(db: Database.Database): ConversationStageService {
    return new ConversationStageService(new ConversationStateRepository(db));
  }

  getState(userId: string): ConversationState {
    return this.repository.findOrCreate(userId);
  }

  prepareTurn(input: PrepareConversationTurnInput): ConversationState {
    const current = this.repository.findOrCreate(input.userId);
    const transition = advanceConversationStage({
      state: current,
      userMessage: input.userMessage,
      classification: input.classification,
      resolvedMenuItems: input.resolvedMenuItems ?? [],
    } satisfies StageTransitionInput);

    const next: ConversationState = {
      ...current,
      stage: transition.stage,
      draftOrder: transition.draftOrder,
      lastSuggestedItems: transition.lastSuggestedItems,
      completedOrdersCount: transition.completedOrdersCount,
    };

    return this.repository.save(next);
  }

  finalizeTurn(userId: string, assistantReply: string): ConversationState {
    const current = this.repository.findOrCreate(userId);

    if (current.stage !== "recommending") {
      return current;
    }

    const extracted = extractSuggestedItemsFromAssistantText(assistantReply);
    if (extracted.length === 0) {
      return current;
    }

    const merged = [...new Set([...current.lastSuggestedItems, ...extracted])];
    return this.repository.save({
      ...current,
      lastSuggestedItems: merged,
    });
  }
}
