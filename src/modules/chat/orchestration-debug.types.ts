import type { Intent, RiskLevel } from "../llm/intent.types.js";

/** Dados de um turno para exibição no modo debug (Issue #10). */
export type OrchestrationDebugSnapshot = {
  userLogin: string;
  intent: Intent;
  usedShortTermMemory: boolean;
  shortTermMessageCount: number;
  usedLongTermMemory: boolean;
  usedRag: boolean;
  retrievedDocs: string[];
  savedFacts: string[];
  riskLevel: RiskLevel;
};
