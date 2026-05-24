import type { Intent, RiskLevel } from "../llm/intent.types.js";
import type { ConversationStage, OrderDraftItem } from "./conversation-stage.types.js";
import type { ToolInvocationRecord } from "./orchestration.tools.js";

/** Dados de um turno para exibição no modo debug (Issue #10). */
export type OrchestrationDebugSnapshot = {
  userLogin: string;
  intent: Intent;
  conversationStage: ConversationStage;
  draftOrder: OrderDraftItem[];
  completedOrdersCount: number;
  usedShortTermMemory: boolean;
  shortTermMessageCount: number;
  usedLongTermMemory: boolean;
  usedRag: boolean;
  retrievedDocs: string[];
  savedFacts: string[];
  riskLevel: RiskLevel;
  /** Issue #16 — explicit tool invocations (hybrid orchestration). */
  toolsInvoked: ToolInvocationRecord[];
};
