import { Document } from "@langchain/core/documents";
import { MarkdownTextSplitter } from "@langchain/textsplitters";
import { CHUNK_OVERLAP, CHUNK_SIZE } from "./rag.config.js";
import type { ChunkedKnowledge, LoadedKnowledgeDocument } from "./rag.types.js";

/**
 * Divide documentos Markdown em chunks para embedding.
 * Usa `MarkdownTextSplitter` (respeita títulos/listas melhor que corte cego).
 */
export async function chunkKnowledgeDocuments(
  loaded: LoadedKnowledgeDocument[],
): Promise<ChunkedKnowledge> {
  if (loaded.length === 0) {
    return { documents: [], totalChunks: 0, filesProcessed: 0 };
  }

  const splitter = new MarkdownTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  const langchainDocs = loaded.map(
    (doc) =>
      new Document({
        pageContent: doc.content,
        metadata: {
          source: doc.source,
          sourcePath: doc.sourcePath,
        },
      }),
  );

  const splitDocs = await splitter.splitDocuments(langchainDocs);

  const nextIndexBySource = new Map<string, number>();

  for (const doc of splitDocs) {
    const source = String(doc.metadata.source ?? "unknown");
    const chunkIndex = nextIndexBySource.get(source) ?? 0;
    doc.metadata.chunkIndex = chunkIndex;
    nextIndexBySource.set(source, chunkIndex + 1);
  }

  return {
    documents: splitDocs,
    totalChunks: splitDocs.length,
    filesProcessed: loaded.length,
  };
}
