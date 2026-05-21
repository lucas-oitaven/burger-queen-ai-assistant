import { OpenAIEmbeddings } from "@langchain/openai";
import { env, requireOpenAiApiKey } from "../../config/env.js";

/**
 * Embeddings OpenAI usados na ingestão (`seed:kb`) e depois no retriever (Issue #6).
 * Modelo padrão: `text-embedding-3-small` (`.env.example`).
 */
export function createOpenAiEmbeddings(): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    apiKey: requireOpenAiApiKey(),
    model: env.OPENAI_EMBEDDING_MODEL,
  });
}
