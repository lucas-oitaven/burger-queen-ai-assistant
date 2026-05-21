import { join } from "node:path";

/** Diretório dos 15 Markdown da Issue #4. */
export const KNOWLEDGE_BASE_DIR = join(process.cwd(), "knowledge-base");

/** Valores alinhados ao `.ai-context` (700–900 / overlap 100–150). */
export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 120;
