import type { Document } from "@langchain/core/documents";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";
import { env } from "../../config/env.js";
import { createOpenAiEmbeddings } from "./embedding.service.js";

export type IndexInChromaOptions = {
  /** Apaga a coleção antes de indexar (evita duplicata ao rodar `seed:kb` de novo). */
  resetCollection?: boolean;
};

function createChromaClient(): ChromaClient {
  const parsed = new URL(env.CHROMA_URL);

  return new ChromaClient({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 8000,
    ssl: parsed.protocol === "https:",
  });
}

/**
 * Verifica se o servidor Chroma responde (falha cedo com mensagem clara).
 */
export async function assertChromaReachable(): Promise<void> {
  const client = createChromaClient();

  try {
    await client.heartbeat();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "erro desconhecido";
    throw new Error(
      `ChromaDB inacessível em ${env.CHROMA_URL}. Inicie com \`chroma run\` ou Docker e tente de novo. Detalhe: ${message}`,
    );
  }
}

/**
 * Remove a coleção configurada em `CHROMA_COLLECTION` (ignora se não existir).
 */
export async function resetChromaCollection(
  collectionName: string = env.CHROMA_COLLECTION,
): Promise<void> {
  const client = createChromaClient();

  try {
    await client.deleteCollection({ name: collectionName });
  } catch {
    // Coleção ainda não criada — ok na primeira ingestão
  }
}

/**
 * Gera embeddings (OpenAI) e grava chunks no Chroma com metadados do `Document`.
 */
export async function indexDocumentsInChroma(
  documents: Document[],
  options: IndexInChromaOptions = {},
): Promise<number> {
  const { resetCollection = true } = options;

  if (documents.length === 0) {
    return 0;
  }

  await assertChromaReachable();

  if (resetCollection) {
    await resetChromaCollection();
  }

  const embeddings = createOpenAiEmbeddings();

  await Chroma.fromDocuments(documents, embeddings, {
    url: env.CHROMA_URL,
    collectionName: env.CHROMA_COLLECTION,
  });

  return documents.length;
}
