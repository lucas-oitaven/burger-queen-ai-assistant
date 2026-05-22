import { env } from "../../config/env.js";
import { classifyIntentFallback } from "./intent-fallback.classifier.js";
import { IntentLlmClassifier } from "./intent-llm.classifier.js";
import type { IntentClassification } from "./intent.types.js";

/** Contrato do classificador LLM (injeta mock nos testes). */
export type IntentLlmPort = {
  classify(message: string): Promise<IntentClassification | null>;
};

export class IntentClassifierService {
  private readonly llm: IntentLlmPort | null;

  constructor(llm?: IntentLlmPort) {
    const apiKey = env.OPENAI_API_KEY?.trim();
    this.llm = llm ?? (apiKey ? new IntentLlmClassifier() : null);
  }

  /**
   * Classifica a mensagem: tenta OpenAI; se JSON inválido, erro ou sem API key,
   * usa `classifyIntentFallback`. Sempre retorna `IntentClassification`.
   */
  async classify(message: string): Promise<IntentClassification> {
    const trimmed = message.trim();

    if (!trimmed) {
      return classifyIntentFallback(message);
    }

    if (!this.llm) {
      return classifyIntentFallback(trimmed);
    }

    try {
      const fromLlm = await this.llm.classify(trimmed);
      if (fromLlm) {
        return fromLlm;
      }
    } catch {
      // segue para fallback determinístico
    }

    return classifyIntentFallback(trimmed);
  }
}
