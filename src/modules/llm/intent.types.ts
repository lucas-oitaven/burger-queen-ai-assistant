import { z } from "zod";

/** Intents principais — alinhado a `.ai-context` (Issue #8). */
export const INTENTS = [
  "greeting",
  "casual_chat",
  "menu_inquiry",
  "hours_delivery_policy",
  "general_recommendation",
  "personalized_recommendation",
  "user_preference_statement",
  "memory_recall",
  "prompt_injection",
  "unknown",
] as const;

export type Intent = (typeof INTENTS)[number];

export const RISK_LEVELS = ["low", "medium", "high"] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

/** Saída do classificador de intenção (LLM ou fallback). */
export type IntentClassification = {
  intent: Intent;
  needsRag: boolean;
  needsUserFacts: boolean;
  shouldExtractFacts: boolean;
  riskLevel: RiskLevel;
  reason: string;
};

export const intentClassificationSchema = z.object({
  intent: z.enum(INTENTS),
  needsRag: z.boolean(),
  needsUserFacts: z.boolean(),
  shouldExtractFacts: z.boolean(),
  riskLevel: z.enum(RISK_LEVELS),
  reason: z.string().min(1),
});

export type ParsedIntentClassification = z.infer<
  typeof intentClassificationSchema
>;

export function isIntent(value: string): value is Intent {
  return (INTENTS as readonly string[]).includes(value);
}

export function isRiskLevel(value: string): value is RiskLevel {
  return (RISK_LEVELS as readonly string[]).includes(value);
}

/**
 * Valida objeto desconhecido (ex.: JSON do LLM). Retorna `null` se inválido.
 */
export function parseIntentClassification(
  data: unknown,
): IntentClassification | null {
  const parsed = intentClassificationSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
