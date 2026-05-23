/**
 * Smoke test Issue #12 Parte 12.1 — eval-cases.json + Zod schema.
 * Uso: npm run verify:eval-cases
 */
import { loadEvalCases } from "../modules/evals/eval.types.js";

function main(): void {
  const file = loadEvalCases();
  const ids = file.cases.map((c) => c.id).join(", ");
  console.log(
    `[verify:eval-cases] OK — ${file.cases.length} cases loaded: ${ids}`,
  );
}

main();
