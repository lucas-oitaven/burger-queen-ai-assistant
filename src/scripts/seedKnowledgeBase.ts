/**
 * Ingere os documentos de knowledge-base/ no ChromaDB.
 * Implementação prevista em issue futura (ingestão RAG).
 */
async function main(): Promise<void> {
  console.log("[seed:kb] Stub — ingestão da knowledge base ainda não implementada.");
  console.log("Próximo passo: carregar Markdown de knowledge-base/ e indexar no ChromaDB.");
}

main().catch((error: unknown) => {
  console.error("[seed:kb] Erro:", error);
  process.exit(1);
});
