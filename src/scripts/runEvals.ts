/**
 * Executa evals/eval-cases.json e grava evals/results/baseline-results.md.
 * Issue #12.3
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { env } from "../config/env.js";
import { closeDatabase, getDatabase } from "../database/sqlite.js";
import { formatBaselineResultsMarkdown } from "../modules/evals/eval-report.formatter.js";
import {
  EvalRunnerService,
  type EvalCaseResult,
} from "../modules/evals/eval-runner.service.js";
import {
  DEFAULT_EVAL_CASES_PATH,
  loadEvalCases,
} from "../modules/evals/eval.types.js";
import { resetDatabase } from "./resetDatabase.js";
import { seedDemoUsers } from "./seedDemoUsers.js";

export const BASELINE_RESULTS_PATH = join(
  process.cwd(),
  "evals",
  "results",
  "baseline-results.md",
);

export type RunEvalSuiteResult = {
  results: EvalCaseResult[];
  reportPath: string;
  passCount: number;
  failCount: number;
  errorCount: number;
};

function buildEnvironmentSummary(): Record<string, string> {
  return {
    OPENAI_API_KEY: env.OPENAI_API_KEY?.trim() ? "set" : "missing",
    OPENAI_CHAT_MODEL: env.OPENAI_CHAT_MODEL,
    CHROMA_URL: env.CHROMA_URL,
    CHROMA_COLLECTION: env.CHROMA_COLLECTION,
    DATABASE_PATH: env.DATABASE_PATH,
  };
}

export async function runEvalSuite(): Promise<RunEvalSuiteResult> {
  console.log("[eval] Burger Queen — evaluation suite\n");

  console.log("[eval] Preparing database (reset + seed:demo)...");
  resetDatabase();
  const seedSummary = seedDemoUsers();
  console.log(
    `[eval] Seed: ${seedSummary.factsInserted} facts inserted, ${seedSummary.factsSkipped} skipped\n`,
  );

  const db = getDatabase();
  const runner = new EvalRunnerService(db);
  const casesFile = loadEvalCases();

  console.log(`[eval] Running ${casesFile.cases.length} cases...\n`);

  const results: EvalCaseResult[] = [];
  for (const evalCase of casesFile.cases) {
    const result = await runner.runCase(evalCase);
    results.push(result);
    const icon =
      result.status === "pass" ? "PASS" : result.status === "fail" ? "FAIL" : "ERROR";
    console.log(`[eval] ${icon} — ${result.caseId}`);
    if (result.failures.length > 0) {
      for (const failure of result.failures) {
        console.log(`       ${failure}`);
      }
    }
    if (result.errorMessage) {
      console.log(`       ${result.errorMessage}`);
    }
  }

  const markdown = formatBaselineResultsMarkdown({
    generatedAt: new Date().toISOString(),
    environment: buildEnvironmentSummary(),
    casesFile: DEFAULT_EVAL_CASES_PATH,
    results,
  });

  mkdirSync(dirname(BASELINE_RESULTS_PATH), { recursive: true });
  writeFileSync(BASELINE_RESULTS_PATH, markdown, "utf-8");

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return {
    results,
    reportPath: BASELINE_RESULTS_PATH,
    passCount,
    failCount,
    errorCount,
  };
}

async function main(): Promise<void> {
  try {
    const summary = await runEvalSuite();

    console.log("\n[eval] Summary");
    console.log(`  PASS:  ${summary.passCount}`);
    console.log(`  FAIL:  ${summary.failCount}`);
    console.log(`  ERROR: ${summary.errorCount}`);
    console.log(`\n[eval] Report: ${summary.reportPath}`);

    if (summary.failCount > 0 || summary.errorCount > 0) {
      console.log("\n[eval] Completed with failures.");
      process.exitCode = 1;
      return;
    }

    console.log("\n[eval] All cases passed.");
  } finally {
    closeDatabase();
  }
}

main().catch((error: unknown) => {
  console.error("\n[eval] Fatal error:", error);
  closeDatabase();
  process.exit(1);
});
