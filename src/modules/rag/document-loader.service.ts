import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { KNOWLEDGE_BASE_DIR } from "./rag.config.js";
import type { LoadedKnowledgeDocument } from "./rag.types.js";

/**
 * Lê todos os `.md` de `knowledge-base/` (ordenados por nome).
 */
export async function loadKnowledgeDocuments(
  baseDir: string = KNOWLEDGE_BASE_DIR,
): Promise<LoadedKnowledgeDocument[]> {
  let entries;
  try {
    entries = await readdir(baseDir, { withFileTypes: true });
  } catch {
    throw new Error(
      `Diretório knowledge-base não encontrado: ${baseDir}. Rode o comando na raiz do projeto.`,
    );
  }

  const fileNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();

  if (fileNames.length === 0) {
    throw new Error(`Nenhum arquivo .md em ${baseDir}`);
  }

  const documents: LoadedKnowledgeDocument[] = [];

  for (const fileName of fileNames) {
    const sourcePath = join(baseDir, fileName);
    const raw = await readFile(sourcePath, "utf-8");
    const content = raw.trim();

    if (!content) {
      throw new Error(`Arquivo vazio: ${fileName}`);
    }

    documents.push({
      source: fileName,
      sourcePath,
      content,
    });
  }

  return documents;
}
