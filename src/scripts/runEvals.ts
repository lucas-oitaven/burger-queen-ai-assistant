/**
 * Executa casos de evals/eval-cases.json e grava relatório em evals/results/.
 * Implementação prevista em issue futura (evals).
 */
async function main(): Promise<void> {
  console.log("[eval] Stub — pipeline de evals ainda não implementado.");
  console.log("Próximo passo: rodar casos de evals/eval-cases.json e gerar evals/results/baseline-results.md.");
}

main().catch((error: unknown) => {
  console.error("[eval] Erro:", error);
  process.exit(1);
});
