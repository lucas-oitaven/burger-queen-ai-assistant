/**
 * Cria usuários de demonstração (ex.: Ana, Bruno) no SQLite.
 * Implementação prevista em issue futura (demo users seed).
 */
async function main(): Promise<void> {
  console.log("[seed:demo] Stub — seed de usuários demo ainda não implementado.");
  console.log("Próximo passo: persistir usuários de exemplo em data/app.sqlite.");
}

main().catch((error: unknown) => {
  console.error("[seed:demo] Erro:", error);
  process.exit(1);
});
