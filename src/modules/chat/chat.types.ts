import type { IntentClassification } from "../llm/intent.types.js";
import type { UserFact } from "../memory/memory.types.js";
import type { RagResult } from "../rag/rag.types.js";
import type { Message } from "./message.types.js";

export type BuildContextInput = {
  userId: string;
  userMessage: string;
  classification: IntentClassification;
};

/** Contexto unificado para o gerador de resposta (Issue #9 — Partes 9.2–9.3). */
export type ChatContext = {
  userId: string;
  userMessage: string;
  classification: IntentClassification;
  recentMessages: Message[];
  userFacts: UserFact[];
  ragResults: RagResult[];
  /** `true` quando `riskLevel === high` — sem RAG/fatos; memória curta reduzida. */
  safeMode: boolean;
};
