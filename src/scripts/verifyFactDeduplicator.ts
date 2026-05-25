/**
 * Valida FactDeduplicatorService (Issue #7 Parte 7.4) — usa SQLite, sem OpenAI.
 * Uso: npm run verify:memory-deduplicator
 */
import { closeDatabase, getDatabase } from "../database/sqlite.js";
import { FactDeduplicatorService } from "../modules/memory/fact-deduplicator.service.js";
import { normalizeFactForDedup } from "../modules/memory/fact-normalize.js";
import { MemoryRepository } from "../modules/memory/memory.repository.js";
import type { CandidateFact } from "../modules/memory/memory.types.js";
import { UserRepository } from "../modules/users/user.repository.js";

function assertLabel(label: string, ok: boolean): boolean {
  console.log(`[verify:memory-deduplicator] ${ok ? "OK" : "FAIL"} — ${label}`);
  return ok;
}

function main(): void {
  let passed = 0;
  let total = 0;

  const normCases: Array<{ input: string; expected: string }> = [
    {
      input: "  Usuário prefere burger vegetariano! ",
      expected: "usuario prefere burger vegetariano",
    },
    {
      input: "Usuária é vegetariana.",
      expected: "usuaria e vegetariana",
    },
    {
      input: "Não gosta de molho apimentado!!!",
      expected: "nao gosta de molho apimentado",
    },
  ];

  for (const { input, expected } of normCases) {
    total += 1;
    const got = normalizeFactForDedup(input);
    if (assertLabel(`normalize: ${input.trim().slice(0, 40)}…`, got === expected)) {
      passed += 1;
    } else {
      console.log(`  expected: ${expected}`);
      console.log(`  got:      ${got}`);
    }
  }

  const db = getDatabase();
  const users = new UserRepository(db);
  const memory = new MemoryRepository(db);
  const dedup = new FactDeduplicatorService(memory);

  const user = users.findOrCreateByLoginName("verify_memory_dedup");
  const loginSuffix = Date.now().toString(36);

  const seedFact = `Usuário prefere burger vegetariano ${loginSuffix}`;
  const seedNormalized = dedup.normalizeFact(seedFact);

  memory.create({
    userId: user.id,
    fact: seedFact,
    normalizedFact: seedNormalized,
    category: "preference",
    confidence: 0.9,
    sourceMessage: "seed dedup test",
  });

  total += 1;
  if (
    assertLabel(
      "duplicate_existing — mesma frase com pontuação",
      dedup.isDuplicate(user.id, `  ${seedFact}!!!  `),
    )
  ) {
    passed += 1;
  }

  total += 1;
  if (
    assertLabel(
      "duplicate_existing — variação de acentos",
      dedup.isDuplicate(
        user.id,
        `Usuario prefere burger vegetariano ${loginSuffix}`,
      ),
    )
  ) {
    passed += 1;
  }

  total += 1;
  const similarSeed = `Usuario nao gosta de molho apimentado ${loginSuffix}`;
  memory.create({
    userId: user.id,
    fact: similarSeed,
    normalizedFact: dedup.normalizeFact(similarSeed),
    category: "negative_preference",
    confidence: 0.9,
    sourceMessage: "seed similar",
  });

  if (
    assertLabel(
      "duplicate_existing — similaridade simples (jaccard)",
      dedup.isDuplicate(
        user.id,
        `O usuário não gosta de molho apimentado ${loginSuffix}`,
      ),
    )
  ) {
    passed += 1;
  }

  total += 1;
  memory.create({
    userId: user.id,
    fact: "É vegetariana (prefere Grão Nobre, Caprese Veg e opções da linha veggie).",
    normalizedFact: dedup.normalizeFact(
      "É vegetariana (prefere Grão Nobre, Caprese Veg e opções da linha veggie).",
    ),
    category: "restriction",
    confidence: 0.95,
    sourceMessage: "seed vegetarian",
  });
  if (
    assertLabel(
      "duplicate_existing — restrição vegetariana equivalente",
      dedup.isDuplicate(user.id, "Usuário é vegetariana"),
    )
  ) {
    passed += 1;
  }

  total += 1;
  const novelFact = `Usuário prefere batata rústica ${loginSuffix}`;
  if (assertLabel("novel fact — não duplicata", !dedup.isDuplicate(user.id, novelFact))) {
    passed += 1;
  }

  const batch: CandidateFact[] = [
    {
      fact: `Usuário gosta de cogumelos ${loginSuffix}`,
      category: "preference",
      confidence: 0.9,
    },
    {
      fact: `Usuario gosta de cogumelos ${loginSuffix}`,
      category: "preference",
      confidence: 0.85,
    },
    {
      fact: `Usuário evita bacon ${loginSuffix}`,
      category: "negative_preference",
      confidence: 0.88,
    },
  ];

  const { novel, skipped } = dedup.filterNovel(user.id, batch);
  total += 1;
  const batchOk =
    novel.length === 2 &&
    skipped.length === 1 &&
    skipped[0]?.reason === "duplicate_batch";
  if (assertLabel("filterNovel batch (2 novel, 1 duplicate_batch)", batchOk)) {
    passed += 1;
  } else {
    console.log(`  novel: ${novel.length}, skipped: ${skipped.length}`);
  }

  console.log(
    `\n[verify:memory-deduplicator] ${passed}/${total} checks passed`,
  );

  closeDatabase();

  if (passed !== total) {
    process.exitCode = 1;
  }
}

main();
