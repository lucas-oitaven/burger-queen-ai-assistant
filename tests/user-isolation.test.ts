import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MessageRepository } from "../src/modules/chat/message.repository.js";
import { normalizeFactForDedup } from "../src/modules/memory/fact-normalize.js";
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

const USER_A_FACT = "Usuário A prefere burger sem lactose";
const USER_A_MESSAGE = "Mensagem exclusiva do usuário A";

describe("user isolation by user_id", () => {
  let db: Database.Database;
  let userAId: string;
  let userBId: string;

  beforeEach(() => {
    db = createTestDatabase();
    const users = new UserRepository(db);
    userAId = users.findOrCreateByLoginName("isolation_user_a").id;
    userBId = users.findOrCreateByLoginName("isolation_user_b").id;
  });

  afterEach(() => {
    closeTestDatabase();
  });

  it("keeps chat messages scoped to each user", () => {
    const messages = new MessageRepository(db);

    messages.create(userAId, "user", USER_A_MESSAGE);
    messages.create(userBId, "user", "Mensagem exclusiva do usuário B");

    const messagesForA = messages.findByUserId(userAId);
    const messagesForB = messages.findByUserId(userBId);

    expect(messagesForA).toHaveLength(1);
    expect(messagesForA[0]?.content).toBe(USER_A_MESSAGE);
    expect(messagesForB).toHaveLength(1);
    expect(messagesForB[0]?.content).not.toBe(USER_A_MESSAGE);

    expect(
      messagesForB.some((message) => message.content === USER_A_MESSAGE),
    ).toBe(false);
    expect(messages.countByUserId(userBId)).toBe(1);
  });

  it("keeps active facts scoped to each user", () => {
    const memory = new MemoryRepository(db);
    const normalized = normalizeFactForDedup(USER_A_FACT);

    memory.create({
      userId: userAId,
      fact: USER_A_FACT,
      normalizedFact: normalized,
      category: "restriction",
      confidence: 0.9,
      sourceMessage: "sou intolerante a lactose",
    });

    memory.create({
      userId: userBId,
      fact: "Usuário B prefere combo smash",
      normalizedFact: normalizeFactForDedup("Usuário B prefere combo smash"),
      category: "preference",
      confidence: 0.9,
      sourceMessage: "quero combo smash",
    });

    const factsForA = memory.findActiveByUserId(userAId);
    const factsForB = memory.findActiveByUserId(userBId);

    expect(factsForA).toHaveLength(1);
    expect(factsForA[0]?.fact).toBe(USER_A_FACT);
    expect(factsForB).toHaveLength(1);
    expect(factsForB.some((fact) => fact.fact === USER_A_FACT)).toBe(false);
    expect(memory.countActiveByUserId(userBId)).toBe(1);
  });

  it("does not persist MemoryService facts under another user id", async () => {
    const memoryRepo = new MemoryRepository(db);
    const stubExtractor: FactExtractorPort = {
      async extractFactsFromMessage(): Promise<CandidateFact[]> {
        return [
          {
            fact: USER_A_FACT,
            category: "restriction",
            confidence: 0.9,
          },
        ];
      },
    };
    const service = new MemoryService(memoryRepo, stubExtractor);

    const result = await service.processUserMessage(
      userAId,
      "Não posso comer lactose",
    );

    expect(result.savedCount).toBe(1);
    expect(service.listActiveFacts(userAId)).toHaveLength(1);
    expect(service.listActiveFacts(userBId)).toHaveLength(0);
    expect(memoryRepo.findActiveByUserId(userBId)).toEqual([]);
  });

  it("assigns distinct UUIDs to different login names", () => {
    expect(userAId).not.toBe(userBId);
    expect(userAId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
