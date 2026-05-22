import type { IntentClassification } from "../llm/intent.types.js";
import type { UserFact } from "../memory/memory.types.js";

/** Resultado de um turno completo do `OrchestratorService` (Issue #9.4). */
export type OrchestrationResult = {
  reply: string;
  classification: IntentClassification;
  userMessageId: number;
  assistantMessageId: number;
  logId: number;
  ragUsed: boolean;
  retrievedDocs: string[];
  savedFacts: UserFact[];
  savedFactsCount: number;
};

/** Registro de decisões do pipeline por turno de chat. */
export type OrchestrationLog = {
  id: number;
  userId: string;
  sessionId: string | null;
  messageId: number | null;
  intent: string;
  needsRag: boolean;
  needsUserFacts: boolean;
  shouldExtractFacts: boolean;
  retrievedDocs: string[];
  savedFacts: string[];
  riskLevel: string;
  createdAt: string;
};

export type CreateOrchestrationLogInput = {
  userId: string;
  messageId: number | null;
  sessionId?: string | null;
  intent: string;
  needsRag: boolean;
  needsUserFacts: boolean;
  shouldExtractFacts: boolean;
  retrievedDocs?: string[];
  savedFacts?: string[];
  riskLevel: string;
};
