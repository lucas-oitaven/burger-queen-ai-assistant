import { ingestKnowledgeBase } from "../modules/rag/kb-ingestion.service.js";
import { env } from "../config/env.js";

async function main(): Promise<void> {
  console.log("[seed:kb] Burger Queen — ingestão da knowledge base");
  console.log(`[seed:kb] Chroma: ${env.CHROMA_URL}`);
  console.log(`[seed:kb] Coleção: ${env.CHROMA_COLLECTION}`);
  console.log(`[seed:kb] Embeddings: ${env.OPENAI_EMBEDDING_MODEL}\n`);

  const startedAt = Date.now();
  const result = await ingestKnowledgeBase();
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log("\n[seed:kb] Resumo");
  console.log(`  Arquivos Markdown processados: ${result.filesProcessed}`);
  console.log(`  Chunks indexados no Chroma:     ${result.chunksIndexed}`);
  console.log(`  Coleção:                        ${result.collectionName}`);
  console.log(`  Tempo:                          ${elapsedSec}s`);
  console.log("\n[seed:kb] Concluído com sucesso.");
}

main().catch((error: unknown) => {
  console.error("\n[seed:kb] Falha na ingestão.");

  if (error instanceof Error) {
    console.error(`[seed:kb] ${error.message}`);
  } else {
    console.error(error);
  }

  console.error(
    "\n[seed:kb] Verifique: Chroma rodando (`chroma run`), OPENAI_API_KEY no .env, pasta knowledge-base/ com 15 .md.",
  );
  process.exit(1);
});
