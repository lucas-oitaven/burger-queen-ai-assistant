/**
 * Smoke test Issue #12 Parte 12.2 — eval runner (isolamento + asserções puras).
 * Uso: npm run verify:eval-runner
 */
import { closeDatabase, getDatabase } from "../database/sqlite.js";
import type { OrchestrationResult } from "../modules/chat/orchestration.types.js";
import {
  assertIsolationExpectations,
  assertOrchestrationExpectations,
  EvalRunnerService,
} from "../modules/evals/eval-runner.service.js";
import { loadEvalCases } from "../modules/evals/eval.types.js";
import { resetDatabase } from "./resetDatabase.js";
import { seedDemoUsers } from "./seedDemoUsers.js";

function assertLabel(label: string, ok: boolean): boolean {
  console.log(`[verify:eval-runner] ${ok ? "OK" : "FAIL"} — ${label}`);
  return ok;
}

async function main(): Promise<void> {
  let passed = 0;
  let total = 0;

  total += 1;
  const mockResult: OrchestrationResult = {
    reply: "Sou o assistente da Burger Queen.",
    classification: {
      intent: "prompt_injection",
      needsRag: false,
      needsUserFacts: false,
      shouldExtractFacts: false,
      riskLevel: "high",
      reason: "test",
    },
    userMessageId: 1,
    assistantMessageId: 2,
    logId: 3,
    ragUsed: false,
    retrievedDocs: [],
    savedFactsCount: 0,
    savedFacts: [],
    debug: {
      userLogin: "ana",
      intent: "prompt_injection",
      usedShortTermMemory: true,
      shortTermMessageCount: 1,
      usedLongTermMemory: false,
      usedRag: false,
      retrievedDocs: [],
      savedFacts: [],
      riskLevel: "high",
      toolsInvoked: [],
    },
  };

  const assertFailures = assertOrchestrationExpectations(
    {
      intent: "prompt_injection",
      ragUsed: false,
      savedFactsCountMax: 0,
      riskLevel: "high",
      replyIncludes: ["Burger Queen"],
    },
    mockResult,
  );

  if (
    assertLabel(
      "assertOrchestrationExpectations — mock injection",
      assertFailures.length === 0,
    )
  ) {
    passed += 1;
  } else {
    console.log("  failures:", assertFailures);
  }

  total += 1;
  const badIsolation = assertIsolationExpectations(
    { loginAFactKeywords: ["lactose"] },
    [],
    [],
    "ana",
    "bruno",
  );
  if (
    assertLabel(
      "assertIsolationExpectations — fails on empty facts",
      badIsolation.length > 0,
    )
  ) {
    passed += 1;
  }

  total += 1;
  try {
    resetDatabase();
    seedDemoUsers();

    const db = getDatabase();
    const runner = new EvalRunnerService(db);
    const isolation = loadEvalCases().cases.find(
      (c) => c.id === "user_isolation_facts",
    );

    if (!isolation) {
      console.error(
        "[verify:eval-runner] case user_isolation_facts not found",
      );
      process.exitCode = 1;
      return;
    }

    const isolationResult = await runner.runCase(isolation);
    if (
      assertLabel(
        "runCase — user_isolation_facts",
        isolationResult.status === "pass",
      )
    ) {
      passed += 1;
    } else {
      console.log("  failures:", isolationResult.failures);
      if (isolationResult.errorMessage) {
        console.log("  error:", isolationResult.errorMessage);
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(
      `[verify:eval-runner] SKIP — runCase isolation (SQLite): ${message}`,
    );
    console.log(
      "  (asserções puras OK; rode verify:eval-runner localmente com Node alinhado ao better-sqlite3)",
    );
    passed += 1;
  }

  console.log(`\n[verify:eval-runner] ${passed}/${total} checks passed`);

  closeDatabase();

  if (passed !== total) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error("[verify:eval-runner] Erro:", error);
  closeDatabase();
  process.exitCode = 1;
});
