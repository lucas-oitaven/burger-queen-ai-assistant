/**
 * Smoke test Issue #12 Parte 12.3 — formatter de relatório (sem DB).
 * Uso: npm run verify:eval-report
 */
import { formatBaselineResultsMarkdown } from "../modules/evals/eval-report.formatter.js";
import type { EvalCaseResult } from "../modules/evals/eval-runner.service.js";

function main(): void {
  const results: EvalCaseResult[] = [
    {
      caseId: "greeting_without_rag",
      description: "Greeting",
      kind: "orchestration",
      status: "pass",
      failures: [],
      evidence: { intent: "greeting", ragUsed: false },
    },
    {
      caseId: "rag_vegetarian_options",
      description: "RAG",
      kind: "orchestration",
      status: "fail",
      failures: ["ragUsed: expected true, got false"],
      evidence: { ragUsed: false },
    },
  ];

  const md = formatBaselineResultsMarkdown({
    generatedAt: "2026-01-01T00:00:00.000Z",
    environment: { OPENAI_API_KEY: "set" },
    casesFile: "evals/eval-cases.json",
    results,
  });

  const ok =
    md.includes("# Burger Queen — Eval baseline") &&
    md.includes("| PASS | 1 |") &&
    md.includes("| FAIL | 1 |") &&
    md.includes("### greeting_without_rag");

  console.log(
    `[verify:eval-report] ${ok ? "OK" : "FAIL"} — baseline markdown formatter`,
  );

  if (!ok) {
    process.exitCode = 1;
  }
}

main();
