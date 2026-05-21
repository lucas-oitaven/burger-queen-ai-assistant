import { env } from "../../config/env.js";
import { chunkKnowledgeDocuments } from "./chunker.service.js";
import { loadKnowledgeDocuments } from "./document-loader.service.js";
import type { IngestionResult } from "./rag.types.js";
import { indexDocumentsInChroma } from "./vector-store.service.js";

/**
 * Pipeline completo: load → chunk → embed → Chroma.
 */
export async function ingestKnowledgeBase(): Promise<IngestionResult> {
  const loaded = await loadKnowledgeDocuments();
  const chunked = await chunkKnowledgeDocuments(loaded);
  const chunksIndexed = await indexDocumentsInChroma(chunked.documents);

  return {
    collectionName: env.CHROMA_COLLECTION,
    filesProcessed: chunked.filesProcessed,
    chunksIndexed,
    chromaUrl: env.CHROMA_URL,
  };
}
