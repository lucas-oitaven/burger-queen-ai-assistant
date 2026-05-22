/**
 * Valida MemoryService (Issue #7 Parte 7.6).
 * - Pipeline com extrator stub: sempre (SQLite).
 * - OpenAI real: só se OPENAI_API_KEY estiver definida.
 * Uso: npm run verify:memory-service
 */
import { closeDatabase, getDatabase } from "../database/sqlite.js";
import { MemoryService } from "../modules/memory/memory.service.js";
import { MemoryRepository } from "../modules/memory/memory.repository.js";
import type {
  CandidateFact,
  FactExtractorPort,
} from "../modules/memory/memory.types.js";
import { UserRepository } from "../modules/users/user.repository.js";
import { env } from "../config/env.js";

function assertLabel(label: string, ok: boolean): boolean {
  console.log(`[verify:memory-service] ${ok ? "OK" : "FAIL"} — ${label}`);
  return ok;
}

function createStubExtractor(
  candidates: CandidateFact[],
): FactExtractorPort {
  return {
    async extractFactsFromMessage(): Promise<CandidateFact[]> {
      return candidates;
    },
  };
}

async function main(): Promise<void> {
  let passed = 0;
  let total = 0;

  const db = getDatabase();
  const users = new UserRepository(db);
  const memoryRepo = new MemoryRepository(db);
  const suffix = Date.now().toString(36);
  const user = users.findOrCreateByLoginName(`verify_memory_svc_${suffix}`);

  const stubCandidates: CandidateFact[] = [
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

  const service = new MemoryService(
    memoryRepo,
    createStubExtractor(stubCandidates),
  );

  total += 1;
  const empty = await service.processUserMessage(user.id, "   ");
  if (
    assertLabel(
      "pipeline — mensagem vazia",
      empty.savedCount === 0 && empty.extractedCount === 0,
    )
  ) {
    passed += 1;
  }

  total += 1;
  const first = await service.processUserMessage(
    user.id,
    `Sou vegetariana ${suffix}`,
  );
  const firstOk =
    first.extractedCount === 4 &&
    first.validatedCount === 2 &&
    first.savedCount === 1 &&
    first.rejectedByValidationCount === 2 &&
    first.skippedByDedupCount === 1;
  if (
    assertLabel(
      "pipeline — stub (1 salvo, 2 rejeitados, 1 dedup batch)",
      firstOk,
    )
  ) {
    passed += 1;
  } else {
    console.log("  got:", first);
  }

  total += 1;
  const second = await service.processUserMessage(
    user.id,
    `Sou vegetariana ${suffix}`,
  );
  const secondOk =
    second.savedCount === 0 &&
    second.skippedByDedupCount >= 2 &&
    second.rejectedByValidationCount === 2;
  if (assertLabel("pipeline — dedup (0 novos salvos)", secondOk)) {
    passed += 1;
  } else {
    console.log("  got:", second);
  }

  total += 1;
  const active = service.listActiveFacts(user.id);
  if (assertLabel("listActiveFacts — 1 fato ativo", active.length === 1)) {
    passed += 1;
  } else {
    console.log("  got count:", active.length, active);
  }

  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.log(
      "\n[verify:memory-service] SKIP live OpenAI — OPENAI_API_KEY não definida",
    );
    closeDatabase();
    console.log(
      `[verify:memory-service] ${passed}/${total} checks passed (stub only)`,
    );
    if (passed !== total) {
      process.exitCode = 1;
    }
    return;
  }

  const liveUser = users.findOrCreateByLoginName(
    `verify_memory_svc_live_${suffix}`,
  );
  const liveService = MemoryService.fromDatabase(db);

  total += 1;
  const live = await liveService.processUserMessage(
    liveUser.id,
    "Sou vegetariana e gosto de hambúrguer com cogumelos.",
  );
  const liveOk = live.savedCount >= 1 && live.extractedCount >= 1;
  if (assertLabel("live — extrator OpenAI + pipeline", liveOk)) {
    passed += 1;
  } else {
    console.log("  got:", live);
  }

  closeDatabase();

  console.log(
    `\n[verify:memory-service] ${passed}/${total} checks passed`,
  );

  if (passed !== total) {
    process.exitCode = 1;
  }
}

void main();
