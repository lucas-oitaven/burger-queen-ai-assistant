import type { IntentClassification } from "../llm/intent.types.js";
import type { UserFact } from "../memory/memory.types.js";
import type { RagResult } from "../rag/rag.types.js";
import type { ConversationState } from "./conversation-stage.types.js";
import type { ToolInvocationRecord } from "./orchestration.tools.js";
import type { Message } from "./message.types.js";

export type BuildContextInput = {
  userId: string;
  userMessage: string;
  classification: IntentClassification;
  conversationState: ConversationState;
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
  /** Tools invoked or skipped this turn (Issue #16 — hybrid orchestration). */
  toolsInvoked: ToolInvocationRecord[];
  /** Fluxo de atendimento — stage + rascunho do pedido (Issue #17.4). */
  conversationState: ConversationState;
};
