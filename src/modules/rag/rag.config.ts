import { join } from "node:path";

/** Diretório dos 15 Markdown da Issue #4. */
export const KNOWLEDGE_BASE_DIR = join(process.cwd(), "knowledge-base");

/** Valores alinhados ao `.ai-context` (700–900 / overlap 100–150). */
export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 120;

/** Chunks retornados por `searchKnowledgeBase` (plano do projeto: topK 4). */
export const RAG_TOP_K = 4;

/**
 * Distância máxima aceita (LangChain/Chroma L2 — menor = mais relevante).
 * Calibrado com `verify:rag` (queries reais costumam ficar ~0.65–0.95).
 */
export const RAG_MAX_DISTANCE = 1.0;

/**
 * Se todos os chunks passarem do limiar, mantém só o melhor quando
 * `score <= RAG_MAX_DISTANCE + RAG_WEAK_RESULT_SLACK` (ex.: horários ~1.05).
 */
export const RAG_WEAK_RESULT_SLACK = 0.25;
