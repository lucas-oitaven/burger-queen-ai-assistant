/**
 * Remove e recria o banco SQLite local conforme DATABASE_PATH.
 * Implementação prevista em issue futura (persistência SQLite).
 */
async function main(): Promise<void> {
  console.log("[reset:db] Stub — reset do banco ainda não implementado.");
  console.log("Próximo passo: aplicar schema.sql e migrations em data/app.sqlite.");
}

main().catch((error: unknown) => {
  console.error("[reset:db] Erro:", error);
  process.exit(1);
});
