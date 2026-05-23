import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository } from "../src/modules/memory/memory.repository.js";
import { MemoryService } from "../src/modules/memory/memory.service.js";
import type {
  CandidateFact,
  FactExtractorPort,
} from "../src/modules/memory/memory.types.js";
import { UserRepository } from "../src/modules/users/user.repository.js";
import {
  closeTestDatabase,
  createTestDatabase,
} from "./helpers/test-database.js";

function createStubExtractor(
  candidates: CandidateFact[],
): FactExtractorPort {
  return {
    async extractFactsFromMessage(): Promise<CandidateFact[]> {
      return candidates;
    },
  };
}

function buildStubCandidates(suffix: string): CandidateFact[] {
  return [
    {
      fact: `Usuário é vegetariano ${suffix}`,
      category: "restriction",
      confidence: 0.9,
    },
    {
      fact: "Hoje está muito calor",
      category: "context",
      confidence: 0.95,
    },
    {
      fact: "Usuário tem desconto vitalício",
      category: "context",
      confidence: 0.99,
    },
    {
      fact: `Usuario e vegetariano ${suffix}`,
      category: "restriction",
      confidence: 0.88,
    },
  ];
}

describe("MemoryService", () => {
  let db: Database.Database;
  let userId: string;
  let service: MemoryService;
  let suffix: string;

  beforeEach(() => {
    db = createTestDatabase();
    suffix = `mem_${Date.now().toString(36)}`;
    const users = new UserRepository(db);
    userId = users.findOrCreateByLoginName(`memory_svc_${suffix}`).id;

    const memoryRepo = new MemoryRepository(db);
    service = new MemoryService(
      memoryRepo,
      createStubExtractor(buildStubCandidates(suffix)),
    );
  });

  afterEach(() => {
    closeTestDatabase();
  });

  it("returns zero counts for empty or whitespace-only messages", async () => {
    const result = await service.processUserMessage(userId, "   ");

    expect(result).toEqual({
      extractedCount: 0,
      validatedCount: 0,
      savedCount: 0,
      rejectedByValidationCount: 0,
      skippedByDedupCount: 0,
      savedFacts: [],
    });
  });

  it("runs extract → validate → dedup pipeline on first message", async () => {
    const result = await service.processUserMessage(
      userId,
      `Sou vegetariana ${suffix}`,
    );

    expect(result.extractedCount).toBe(4);
    expect(result.validatedCount).toBe(2);
    expect(result.savedCount).toBe(1);
    expect(result.rejectedByValidationCount).toBe(2);
    expect(result.skippedByDedupCount).toBe(1);
    expect(result.savedFacts).toHaveLength(1);
    expect(result.savedFacts[0]?.fact).toContain(suffix);
  });

  it("rejects unsafe and temporary candidates without persisting them", async () => {
    const result = await service.processUserMessage(
      userId,
      `Sou vegetariana ${suffix}`,
    );

    const active = service.listActiveFacts(userId);

    expect(result.rejectedByValidationCount).toBe(2);
    expect(active).toHaveLength(1);
    expect(active[0]?.category).toBe("restriction");
    expect(
      active.some((fact) => fact.fact.includes("desconto vitalício")),
    ).toBe(false);
    expect(active.some((fact) => /calor/i.test(fact.fact))).toBe(false);
  });

  it("deduplicates when the same message is processed again", async () => {
    const message = `Sou vegetariana ${suffix}`;

    const first = await service.processUserMessage(userId, message);
    expect(first.savedCount).toBe(1);

    const second = await service.processUserMessage(userId, message);

    expect(second.savedCount).toBe(0);
    expect(second.skippedByDedupCount).toBeGreaterThanOrEqual(2);
    expect(second.rejectedByValidationCount).toBe(2);
    expect(service.listActiveFacts(userId)).toHaveLength(1);
  });
});
