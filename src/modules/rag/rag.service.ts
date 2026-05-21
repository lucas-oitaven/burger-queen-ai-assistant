import {
  RAG_MAX_DISTANCE,
  RAG_TOP_K,
  RAG_WEAK_RESULT_SLACK,
} from "./rag.config.js";
import type {
  RagDebugSnapshot,
  RagResult,
  SearchKnowledgeBaseOptions,
} from "./rag.types.js";
import { loadChromaKnowledgeStore } from "./vector-store.service.js";

function mapDocumentToRagResult(
  doc: { pageContent: string; metadata?: Record<string, unknown> },
  score: number,
): RagResult {
  const metadata = doc.metadata ?? {};

  return {
    content: doc.pageContent,
    source: String(metadata.source ?? "unknown"),
    score,
    sourcePath:
      typeof metadata.sourcePath === "string" ? metadata.sourcePath : undefined,
    chunkIndex:
      typeof metadata.chunkIndex === "number" ? metadata.chunkIndex : undefined,
  };
}

/**
 * Remove chunks cuja distância excede o limiar (similaridade fraca).
 * Sem `score`, o chunk é mantido (comportamento conservador).
 */
export function filterWeakRagResults(
  results: RagResult[],
  maxDistance: number = RAG_MAX_DISTANCE,
): RagResult[] {
  const filtered = results.filter(
    (result) => result.score === undefined || result.score <= maxDistance,
  );

  if (filtered.length > 0) {
    return filtered;
  }

  const withScore = results.filter((result) => result.score !== undefined);
  if (withScore.length === 0) {
    return results;
  }

  const best = withScore.reduce((a, b) =>
    a.score! <= b.score! ? a : b,
  );
  const weakCap = maxDistance + RAG_WEAK_RESULT_SLACK;

  if (best.score! <= weakCap) {
    return [best];
  }

  return [];
}

/**
 * Monta estrutura para o modo debug: `usedRag`, fontes únicas e resultados finais.
 */
export function buildRagDebugSnapshot(
  query: string,
  results: RagResult[],
): RagDebugSnapshot {
  const retrievedDocs = [
    ...new Set(results.map((result) => result.source)),
  ].sort();

  return {
    usedRag: results.length > 0,
    query,
    retrievedDocs,
    results,
    notice:
      results.length === 0
        ? "No relevant knowledge base chunks (empty query, weak similarity, or none indexed)."
        : undefined,
  };
}

/**
 * Linhas legíveis no estilo do debug do projeto (Issue #10).
 */
export function formatRagDebugLines(snapshot: RagDebugSnapshot): string[] {
  const lines: string[] = [`Used RAG: ${snapshot.usedRag}`];

  if (snapshot.notice) {
    lines.push(snapshot.notice);
  }

  if (snapshot.retrievedDocs.length > 0) {
    lines.push("Retrieved docs:");
    for (const doc of snapshot.retrievedDocs) {
      lines.push(`- ${doc}`);
    }
  }

  for (const result of snapshot.results) {
    const chunk =
      result.chunkIndex !== undefined ? `#${result.chunkIndex}` : "";
    const score =
      result.score !== undefined ? result.score.toFixed(4) : "n/a";
    lines.push(`  [${result.source}${chunk}] score=${score}`);
  }

  return lines;
}

/**
 * Busca semântica na knowledge base indexada no Chroma.
 * Requer `chroma run`, `npm run seed:kb` e `OPENAI_API_KEY` no `.env`.
 */
export async function searchKnowledgeBase(
  query: string,
  options: SearchKnowledgeBaseOptions = {},
): Promise<RagResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const topK = options.topK ?? RAG_TOP_K;
  const store = await loadChromaKnowledgeStore();
  const pairs = await store.similaritySearchWithScore(trimmed, topK);
  const mapped = pairs.map(([doc, score]) => mapDocumentToRagResult(doc, score));
  const maxDistance = options.maxDistance ?? RAG_MAX_DISTANCE;

  return filterWeakRagResults(mapped, maxDistance);
}
