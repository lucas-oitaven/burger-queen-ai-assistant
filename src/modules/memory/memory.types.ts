/** Categorias permitidas para fatos extraídos (`.ai-context`). */
export const FACT_CATEGORIES = [
  "preference",
  "restriction",
  "allergy",
  "goal",
  "habit",
  "context",
  "negative_preference",
] as const;

export type FactCategory = (typeof FACT_CATEGORIES)[number];

export const FACT_STATUSES = ["active", "rejected", "archived"] as const;

export type FactStatus = (typeof FACT_STATUSES)[number];

/** Confiança mínima para persistir (validador — Parte 7.3). */
export const MIN_FACT_CONFIDENCE = 0.7;

/** Motivo de rejeição do `FactValidatorService`. */
export type FactRejectionReason =
  | "empty_fact"
  | "invalid_category"
  | "low_confidence"
  | "temporary"
  | "unsafe";

/** Fato sugerido pelo extrator antes de validar/deduplicar. */
export type CandidateFact = {
  fact: string;
  category: FactCategory;
  confidence: number;
};

/** Fato persistido em `user_facts`. */
export type UserFact = {
  id: number;
  userId: string;
  fact: string;
  normalizedFact: string | null;
  category: FactCategory | null;
  confidence: number;
  sourceMessage: string | null;
  status: FactStatus;
  createdAt: string;
  updatedAt: string;
};

/** Saída estruturada do `FactExtractorService` (Parte 7.5). */
export type FactExtractionResult = {
  facts: CandidateFact[];
};

/** Contrato do extrator para injeção no `MemoryService` (testes / produção). */
export type FactExtractorPort = {
  extractFactsFromMessage(message: string): Promise<CandidateFact[]>;
};

/** Resultado de `MemoryService.processUserMessage` (debug / CLI 7.7). */
export type ProcessUserMessageResult = {
  extractedCount: number;
  validatedCount: number;
  savedCount: number;
  rejectedByValidationCount: number;
  skippedByDedupCount: number;
  savedFacts: UserFact[];
};

/** Dados para inserir em `user_facts` após validação/deduplicação. */
export type CreateUserFactInput = {
  userId: string;
  fact: string;
  normalizedFact: string;
  category: FactCategory;
  confidence: number;
  sourceMessage: string;
  status?: FactStatus;
};

export function isFactCategory(value: string): value is FactCategory {
  return (FACT_CATEGORIES as readonly string[]).includes(value);
}

export function isFactStatus(value: string): value is FactStatus {
  return (FACT_STATUSES as readonly string[]).includes(value);
}
