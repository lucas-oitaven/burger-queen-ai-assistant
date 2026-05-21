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

/** Trecho recuperado do Chroma por `searchKnowledgeBase` (Issue #6). */
export type RagResult = {
  content: string;
  source: string;
  /** Distância do LangChain/Chroma — menor costuma indicar maior relevância. */
  score?: number;
  sourcePath?: string;
  chunkIndex?: number;
};

export type SearchKnowledgeBaseOptions = {
  topK?: number;
  /** Sobrescreve `RAG_MAX_DISTANCE` ao filtrar chunks fracos. */
  maxDistance?: number;
};

/** Snapshot estável para `/debug` (Issue #10) e logs. */
export type RagDebugSnapshot = {
  usedRag: boolean;
  query: string;
  retrievedDocs: string[];
  results: RagResult[];
  /** Preenchido quando a busca não trouxe chunks utilizáveis. */
  notice?: string;
};
