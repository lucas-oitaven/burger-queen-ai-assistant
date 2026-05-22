import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { env, requireOpenAiApiKey } from "../../config/env.js";
import { parseJsonSafe } from "../../utils/safe-json.js";
import {
  FACT_EXTRACTION_SYSTEM_PROMPT,
  buildFactExtractionUserMessage,
} from "./fact-extraction.prompt.js";
import {
  type CandidateFact,
  type FactCategory,
  isFactCategory,
} from "./memory.types.js";

const rawExtractedFactSchema = z.object({
  fact: z.string(),
  category: z.string(),
  confidence: z.number(),
});

const factExtractionResponseSchema = z.object({
  facts: z.array(rawExtractedFactSchema).default([]),
});

function mapParsedFacts(data: unknown): CandidateFact[] {
  const parsed = factExtractionResponseSchema.safeParse(data);
  if (!parsed.success) {
    return [];
  }

  const candidates: CandidateFact[] = [];

  for (const item of parsed.data.facts) {
    const fact = item.fact.trim();
    if (!fact || !isFactCategory(item.category)) {
      continue;
    }

    if (!Number.isFinite(item.confidence)) {
      continue;
    }

    candidates.push({
      fact,
      category: item.category as FactCategory,
      confidence: item.confidence,
    });
  }

  return candidates;
}

/**
 * Converte texto bruto do modelo (JSON ou markdown) em candidatos validados.
 * JSON inválido ou fora do schema → `[]`.
 */
export function parseFactExtractionFromText(raw: string): CandidateFact[] {
  const json = parseJsonSafe(raw);
  if (json === null) {
    return [];
  }

  return mapParsedFacts(json);
}

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

export class FactExtractorService {
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

  /**
   * Extrai fatos candidatos da mensagem. Não persiste no banco.
   */
  async extractFactsFromMessage(message: string): Promise<CandidateFact[]> {
    const trimmed = message.trim();
    if (!trimmed) {
      return [];
    }

    const response = await this.model.invoke([
      { role: "system", content: FACT_EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: buildFactExtractionUserMessage(trimmed) },
    ]);

    return parseFactExtractionFromText(extractMessageText(response.content));
  }
}
