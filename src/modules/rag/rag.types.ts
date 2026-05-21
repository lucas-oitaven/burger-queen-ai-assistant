import type { Document } from "@langchain/core/documents";

/** Metadados gravados em cada chunk no Chroma (preserva fonte). */
export type KnowledgeChunkMetadata = {
  source: string;
  sourcePath: string;
  chunkIndex: number;
};

/** Documento Markdown carregado de `knowledge-base/` antes do chunking. */
export type LoadedKnowledgeDocument = {
  source: string;
  sourcePath: string;
  content: string;
};

export type ChunkedKnowledge = {
  documents: Document[];
  totalChunks: number;
  filesProcessed: number;
};

export type IngestionResult = {
  collectionName: string;
  filesProcessed: number;
  chunksIndexed: number;
  chromaUrl: string;
};
