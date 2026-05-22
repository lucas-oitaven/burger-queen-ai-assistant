import { ChatOpenAI } from "@langchain/openai";
import { env, requireOpenAiApiKey } from "../../config/env.js";
import {
  INTENT_CLASSIFICATION_SYSTEM_PROMPT,
  buildIntentClassificationUserMessage,
} from "./intent-classification.prompt.js";
import { parseIntentClassificationFromText } from "./intent-llm.parser.js";
import type { IntentClassification } from "./intent.types.js";

function extractMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
        return "";
      })
      .join("");
  }

  return String(content ?? "");
}

/**
 * Classifica via OpenAI. Retorna `null` se a resposta não for JSON válido
 * (o `IntentClassifierService` na 8.4 aplica fallback nesse caso).
 */
export class IntentLlmClassifier {
  private readonly model: ChatOpenAI;

  constructor(model?: ChatOpenAI) {
    this.model =
      model ??
      new ChatOpenAI({
        apiKey: requireOpenAiApiKey(),
        model: env.OPENAI_CHAT_MODEL,
        temperature: 0,
      });
  }

  async classify(message: string): Promise<IntentClassification | null> {
    const trimmed = message.trim();
    if (!trimmed) {
      return null;
    }

    const response = await this.model.invoke([
      { role: "system", content: INTENT_CLASSIFICATION_SYSTEM_PROMPT },
      { role: "user", content: buildIntentClassificationUserMessage(trimmed) },
    ]);

    return parseIntentClassificationFromText(
      extractMessageText(response.content),
    );
  }
}
