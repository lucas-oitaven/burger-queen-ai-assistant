import type Database from "better-sqlite3";
import { OrchestratorService } from "../chat/orchestrator.service.js";
import type { OrchestrationResult } from "../chat/orchestration.types.js";
import { MemoryRepository } from "../memory/memory.repository.js";
import { normalizeFactForDedup } from "../memory/fact-normalize.js";
import type { UserFact } from "../memory/memory.types.js";
import { UserRepository } from "../users/user.repository.js";
import type { EvalCase, EvalExpectation } from "./eval.types.js";

export type EvalCaseStatus = "pass" | "fail" | "error";

export type EvalCaseResult = {
  caseId: string;
  description: string;
  kind: EvalCase["kind"];
  status: EvalCaseStatus;
  failures: string[];
  evidence: Record<string, unknown>;
  errorMessage?: string;
};

function normalizeKeywordText(text: string): string {
  return normalizeFactForDedup(text);
}

function factsContainKeyword(facts: UserFact[], keyword: string): boolean {
  const needle = normalizeKeywordText(keyword);
  const haystack = normalizeKeywordText(facts.map((f) => f.fact).join(" "));
  return haystack.includes(needle);
}

export function assertOrchestrationExpectations(
  expect: EvalExpectation,
  result: OrchestrationResult,
): string[] {
  const failures: string[] = [];
  const classification = result.classification;

  if (expect.intent !== undefined && classification.intent !== expect.intent) {
    failures.push(
      `intent: expected ${expect.intent}, got ${classification.intent}`,
    );
  }

  if (
    expect.needsRag !== undefined &&
    classification.needsRag !== expect.needsRag
  ) {
    failures.push(
      `needsRag: expected ${expect.needsRag}, got ${classification.needsRag}`,
    );
  }

  if (expect.ragUsed !== undefined && result.ragUsed !== expect.ragUsed) {
    failures.push(`ragUsed: expected ${expect.ragUsed}, got ${result.ragUsed}`);
  }

  if (
    expect.usedLongTermMemory !== undefined &&
    result.debug.usedLongTermMemory !== expect.usedLongTermMemory
  ) {
    failures.push(
      `usedLongTermMemory: expected ${expect.usedLongTermMemory}, got ${result.debug.usedLongTermMemory}`,
    );
  }

  if (expect.riskLevel !== undefined && classification.riskLevel !== expect.riskLevel) {
    failures.push(
      `riskLevel: expected ${expect.riskLevel}, got ${classification.riskLevel}`,
    );
  }

  if (
    expect.savedFactsCountMax !== undefined &&
    result.savedFactsCount > expect.savedFactsCountMax
  ) {
    failures.push(
      `savedFactsCount: expected <= ${expect.savedFactsCountMax}, got ${result.savedFactsCount}`,
    );
  }

  if (expect.retrievedDocIncludes) {
    for (const doc of expect.retrievedDocIncludes) {
      const found = result.retrievedDocs.some(
        (name) => name === doc || name.includes(doc),
      );
      if (!found) {
        failures.push(
          `retrievedDocs: missing "${doc}" (have: ${result.retrievedDocs.join(", ") || "(none)"})`,
        );
      }
    }
  }

  if (expect.replyIncludes) {
    const replyNorm = normalizeKeywordText(result.reply);
    for (const fragment of expect.replyIncludes) {
      if (!replyNorm.includes(normalizeKeywordText(fragment))) {
        failures.push(`reply: missing "${fragment}"`);
      }
    }
  }

  return failures;
}

export function assertIsolationExpectations(
  expect: EvalExpectation,
  factsA: UserFact[],
  factsB: UserFact[],
  loginA: string,
  loginB: string,
): string[] {
  const failures: string[] = [];

  if (expect.loginAFactKeywords) {
    for (const keyword of expect.loginAFactKeywords) {
      if (!factsContainKeyword(factsA, keyword)) {
        failures.push(
          `${loginA} facts: missing keyword "${keyword}"`,
        );
      }
    }
  }

  if (expect.loginBFactKeywords) {
    for (const keyword of expect.loginBFactKeywords) {
      if (!factsContainKeyword(factsB, keyword)) {
        failures.push(
          `${loginB} facts: missing keyword "${keyword}"`,
        );
      }
    }
  }

  if (expect.noSharedNormalizedFacts) {
    const normalizedA = new Set(
      factsA
        .map((f) => f.normalizedFact)
        .filter((value): value is string => Boolean(value)),
    );

    for (const fact of factsB) {
      if (fact.normalizedFact && normalizedA.has(fact.normalizedFact)) {
        failures.push(
          `shared normalized_fact: "${fact.normalizedFact}" (${loginA} & ${loginB})`,
        );
      }
    }
  }

  return failures;
}

export class EvalRunnerService {
  private readonly users: UserRepository;
  private readonly memory: MemoryRepository;
  private readonly orchestrator: OrchestratorService;

  constructor(db: Database.Database, orchestrator?: OrchestratorService) {
    this.users = new UserRepository(db);
    this.memory = new MemoryRepository(db);
    this.orchestrator =
      orchestrator ?? OrchestratorService.fromDatabase(db);
  }

  async runCase(evalCase: EvalCase): Promise<EvalCaseResult> {
    const base: Omit<EvalCaseResult, "status" | "failures" | "evidence"> = {
      caseId: evalCase.id,
      description: evalCase.description,
      kind: evalCase.kind,
    };

    try {
      if (evalCase.kind === "isolation_db") {
        return this.runIsolationCase(evalCase, base);
      }

      return await this.runOrchestrationCase(evalCase, base);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      return {
        ...base,
        status: "error",
        failures: [],
        evidence: {},
        errorMessage: message,
      };
    }
  }

  async runAll(cases: EvalCase[]): Promise<EvalCaseResult[]> {
    const results: EvalCaseResult[] = [];
    for (const evalCase of cases) {
      results.push(await this.runCase(evalCase));
    }
    return results;
  }

  private async runOrchestrationCase(
    evalCase: EvalCase,
    base: Omit<EvalCaseResult, "status" | "failures" | "evidence">,
  ): Promise<EvalCaseResult> {
    if (!evalCase.loginName?.trim()) {
      return {
        ...base,
        status: "error",
        failures: [],
        evidence: {},
        errorMessage: "orchestration case requires loginName",
      };
    }

    if (evalCase.message === undefined) {
      return {
        ...base,
        status: "error",
        failures: [],
        evidence: {},
        errorMessage: "orchestration case requires message",
      };
    }

    const user = this.users.findOrCreateByLoginName(evalCase.loginName);
    const result = await this.orchestrator.handleUserMessage(
      user.id,
      evalCase.message,
    );

    const failures = assertOrchestrationExpectations(evalCase.expect, result);
    const evidence = buildOrchestrationEvidence(result);

    return {
      ...base,
      status: failures.length === 0 ? "pass" : "fail",
      failures,
      evidence,
    };
  }

  private runIsolationCase(
    evalCase: EvalCase,
    base: Omit<EvalCaseResult, "status" | "failures" | "evidence">,
  ): EvalCaseResult {
    const [loginA, loginB] = evalCase.expect.compareLogins ?? [];

    if (!loginA || !loginB) {
      return {
        ...base,
        status: "error",
        failures: [],
        evidence: {},
        errorMessage: "isolation_db case requires expect.compareLogins [a, b]",
      };
    }

    const userA = this.users.findByLoginName(loginA);
    const userB = this.users.findByLoginName(loginB);

    if (!userA || !userB) {
      return {
        ...base,
        status: "fail",
        failures: [
          !userA ? `user not found: ${loginA}` : "",
          !userB ? `user not found: ${loginB}` : "",
        ].filter(Boolean),
        evidence: { loginA, loginB },
      };
    }

    if (userA.id === userB.id) {
      return {
        ...base,
        status: "fail",
        failures: ["compareLogins must resolve to distinct user_id"],
        evidence: { userIdA: userA.id, userIdB: userB.id },
      };
    }

    const factsA = this.memory.findActiveByUserId(userA.id);
    const factsB = this.memory.findActiveByUserId(userB.id);

    const failures = assertIsolationExpectations(
      evalCase.expect,
      factsA,
      factsB,
      loginA,
      loginB,
    );

    return {
      ...base,
      status: failures.length === 0 ? "pass" : "fail",
      failures,
      evidence: {
        loginA,
        loginB,
        userIdA: userA.id,
        userIdB: userB.id,
        factsACount: factsA.length,
        factsBCount: factsB.length,
        factsA: factsA.map((f) => f.fact),
        factsB: factsB.map((f) => f.fact),
      },
    };
  }
}

function buildOrchestrationEvidence(
  result: OrchestrationResult,
): Record<string, unknown> {
  return {
    intent: result.classification.intent,
    needsRag: result.classification.needsRag,
    ragUsed: result.ragUsed,
    retrievedDocs: result.retrievedDocs,
    usedLongTermMemory: result.debug.usedLongTermMemory,
    usedShortTermMemory: result.debug.usedShortTermMemory,
    savedFactsCount: result.savedFactsCount,
    riskLevel: result.classification.riskLevel,
    replyPreview: result.reply.slice(0, 120),
  };
}
