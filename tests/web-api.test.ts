import type Database from "better-sqlite3";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContextBuilderService } from "../src/modules/chat/context-builder.service.js";
import { ConversationStageService } from "../src/modules/chat/conversation-stage.service.js";
import { MessageRepository } from "../src/modules/chat/message.repository.js";
import { OrchestrationLogRepository } from "../src/modules/chat/orchestration-log.repository.js";
import type { OrchestrationResult } from "../src/modules/chat/orchestration.types.js";
import { OrchestratorService } from "../src/modules/chat/orchestrator.service.js";
import { ResponseGeneratorService } from "../src/modules/chat/response-generator.service.js";
import { ToolExecutorService } from "../src/modules/chat/tool-executor.service.js";
import { IntentClassifierService } from "../src/modules/llm/intent-classifier.service.js";
import { classifyIntentFallback } from "../src/modules/llm/intent-fallback.classifier.js";
import { normalizeFactForDedup } from "../src/modules/memory/fact-normalize.js";
import { MemoryRepository } from "../src/modules/memory/memory.repository.js";
import { MemoryService } from "../src/modules/memory/memory.service.js";
import type { FactCategory } from "../src/modules/memory/memory.types.js";
import { UserRepository } from "../src/modules/users/user.repository.js";
import { createWebApp } from "../src/web/create-app.js";
import type { WebAppDependencies } from "../src/web/web.dependencies.js";
import {
  closeTestDatabase,
  createTestDatabase,
} from "./helpers/test-database.js";

function seedUserFact(
  db: Database.Database,
  userId: string,
  fact: string,
  category: FactCategory,
): void {
  const memory = new MemoryRepository(db);
  memory.create({
    userId,
    fact,
    normalizedFact: normalizeFactForDedup(fact),
    category,
    confidence: 0.95,
    sourceMessage: "web-api.test.ts",
  });
}

function buildStubOrchestrationResult(
  message: string,
  reply = "Resposta stub do assistente.",
): OrchestrationResult {
  const classification = classifyIntentFallback(message);

  return {
    reply,
    classification,
    userMessageId: 1,
    assistantMessageId: 2,
    logId: 1,
    ragUsed: false,
    retrievedDocs: [],
    savedFacts: [],
    savedFactsCount: 0,
    debug: {
      userLogin: "test",
      intent: classification.intent,
      conversationStage: "greeting",
      draftOrder: [],
      completedOrdersCount: 0,
      usedShortTermMemory: false,
      shortTermMessageCount: 0,
      usedLongTermMemory: false,
      usedRag: false,
      retrievedDocs: [],
      savedFacts: [],
      riskLevel: classification.riskLevel,
      toolsInvoked: [],
    },
  };
}

function createStubOrchestrator(
  reply = "Resposta stub do assistente.",
): Pick<OrchestratorService, "handleUserMessage"> {
  return {
    async handleUserMessage(_userId, message) {
      return buildStubOrchestrationResult(message, reply);
    },
  };
}

function createTestApp(
  db: Database.Database,
  orchestrator: Pick<OrchestratorService, "handleUserMessage"> = createStubOrchestrator(),
) {
  const deps: WebAppDependencies = {
    userRepository: new UserRepository(db),
    messageRepository: new MessageRepository(db),
    memoryService: MemoryService.fromDatabase(db),
    orchestrator: orchestrator as OrchestratorService,
  };

  return createWebApp(deps);
}

function createOfflineOrchestrator(db: Database.Database): OrchestratorService {
  const messages = new MessageRepository(db);
  const users = new UserRepository(db);
  const memoryRepo = new MemoryRepository(db);
  const logs = new OrchestrationLogRepository(db);
  const memoryService = new MemoryService(memoryRepo, {
    async extractFactsFromMessage() {
      return [];
    },
  });
  const toolExecutor = new ToolExecutorService(messages, memoryService, {
    async search() {
      return [];
    },
  });

  return new OrchestratorService(
    messages,
    users,
    new IntentClassifierService({
      async classify(message) {
        return classifyIntentFallback(message);
      },
    }),
    new ContextBuilderService(toolExecutor),
    new ResponseGeneratorService({
      async invoke() {
        return "Resposta offline do assistente.";
      },
    }),
    toolExecutor,
    logs,
    ConversationStageService.fromDatabase(db),
  );
}

describe("web API", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    closeTestDatabase();
  });

  it("GET /api/health returns ok", async () => {
    const app = createTestApp(db);

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("POST /api/login creates user and returns userId", async () => {
    const app = createTestApp(db);

    const response = await request(app)
      .post("/api/login")
      .send({ loginName: "carla" });

    expect(response.status).toBe(200);
    expect(response.body.loginName).toBe("carla");
    expect(response.body.displayName).toBeTruthy();
    expect(response.body.userId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("POST /api/login reuses the same userId for the same loginName", async () => {
    const app = createTestApp(db);

    const first = await request(app)
      .post("/api/login")
      .send({ loginName: "ana" });
    const second = await request(app)
      .post("/api/login")
      .send({ loginName: "ana" });

    expect(first.body.userId).toBe(second.body.userId);
  });

  it("POST /api/login rejects empty loginName", async () => {
    const app = createTestApp(db);

    const response = await request(app)
      .post("/api/login")
      .send({ loginName: "   " });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid request");
  });

  it("GET /api/facts returns active facts for the user", async () => {
    const app = createTestApp(db);
    const users = new UserRepository(db);
    const user = users.findOrCreateByLoginName("carla");

    seedUserFact(
      db,
      user.id,
      "É vegetariana (prefere Grão Nobre, Caprese Veg e opções da linha veggie).",
      "restriction",
    );

    const response = await request(app).get("/api/facts").query({ userId: user.id });

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe(user.id);
    expect(response.body.facts).toHaveLength(1);
    expect(response.body.facts[0]?.category).toBe("restriction");
    expect(response.body.facts[0]?.fact).toContain("vegetariana");
  });

  it("GET /api/facts rejects invalid userId", async () => {
    const app = createTestApp(db);

    const response = await request(app)
      .get("/api/facts")
      .query({ userId: "not-a-uuid" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid query");
  });

  it("GET /api/facts returns 404 for unknown user", async () => {
    const app = createTestApp(db);

    const response = await request(app)
      .get("/api/facts")
      .query({ userId: "00000000-0000-4000-8000-000000000001" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("User not found");
  });

  it("isolates facts between two logged-in users", async () => {
    const app = createTestApp(db);

    const carlaLogin = await request(app)
      .post("/api/login")
      .send({ loginName: "carla" });
    const brunoLogin = await request(app)
      .post("/api/login")
      .send({ loginName: "bruno" });

    seedUserFact(
      db,
      carlaLogin.body.userId,
      "É vegetariana.",
      "restriction",
    );
    seedUserFact(
      db,
      brunoLogin.body.userId,
      "Prefere hambúrguer com bacon.",
      "preference",
    );

    const carlaFacts = await request(app)
      .get("/api/facts")
      .query({ userId: carlaLogin.body.userId });
    const brunoFacts = await request(app)
      .get("/api/facts")
      .query({ userId: brunoLogin.body.userId });

    expect(carlaFacts.body.facts).toHaveLength(1);
    expect(brunoFacts.body.facts).toHaveLength(1);
    expect(carlaFacts.body.facts[0]?.fact).toContain("vegetariana");
    expect(brunoFacts.body.facts[0]?.fact).toContain("bacon");
    expect(JSON.stringify(carlaFacts.body.facts)).not.toBe(
      JSON.stringify(brunoFacts.body.facts),
    );
  });

  it("POST /api/chat returns assistant reply from orchestrator", async () => {
    const app = createTestApp(db);
    const users = new UserRepository(db);
    const user = users.findOrCreateByLoginName("carla");

    const response = await request(app).post("/api/chat").send({
      userId: user.id,
      message: "Oi",
    });

    expect(response.status).toBe(200);
    expect(response.body.reply).toBe("Resposta stub do assistente.");
    expect(response.body.ragUsed).toBe(false);
    expect(response.body.savedFactsCount).toBe(0);
    expect(Array.isArray(response.body.retrievedDocs)).toBe(true);
  });

  it("POST /api/chat includes debug snapshot when debug=true", async () => {
    const app = createTestApp(db);
    const users = new UserRepository(db);
    const user = users.findOrCreateByLoginName("ana");

    const response = await request(app).post("/api/chat").send({
      userId: user.id,
      message: "Oi",
      debug: true,
    });

    expect(response.status).toBe(200);
    expect(response.body.debug?.intent).toBe("greeting");
    expect(Array.isArray(response.body.debug?.toolsInvoked)).toBe(true);
  });

  it("POST /api/chat rejects invalid userId", async () => {
    const app = createTestApp(db);

    const response = await request(app).post("/api/chat").send({
      userId: "not-a-uuid",
      message: "Oi",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid request");
  });

  it("POST /api/chat returns 404 for unknown user", async () => {
    const app = createTestApp(db);

    const response = await request(app).post("/api/chat").send({
      userId: "00000000-0000-4000-8000-000000000001",
      message: "Oi",
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("User not found");
  });

  it("GET /api/messages returns persisted chat history", async () => {
    const app = createTestApp(db, createOfflineOrchestrator(db));
    const users = new UserRepository(db);
    const user = users.findOrCreateByLoginName("carla");

    const chat = await request(app).post("/api/chat").send({
      userId: user.id,
      message: "Oi",
    });
    expect(chat.status).toBe(200);

    const response = await request(app)
      .get("/api/messages")
      .query({ userId: user.id });

    expect(response.status).toBe(200);
    expect(response.body.messages).toHaveLength(2);
    expect(response.body.messages[0]?.role).toBe("user");
    expect(response.body.messages[0]?.content).toBe("Oi");
    expect(response.body.messages[1]?.role).toBe("assistant");
    expect(response.body.messages[1]?.content).toContain("offline");
  });

  it("GET /api/messages rejects invalid userId", async () => {
    const app = createTestApp(db);

    const response = await request(app)
      .get("/api/messages")
      .query({ userId: "bad-id" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid query");
  });
});
