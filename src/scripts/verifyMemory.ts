/**
 * Smoke test do MemoryRepository (Issue #7 Parte 7.2).
 * Uso: npx tsx src/scripts/verifyMemory.ts
 */
import { closeDatabase, getDatabase } from "../database/sqlite.js";
import { MemoryRepository } from "../modules/memory/memory.repository.js";
import { UserRepository } from "../modules/users/user.repository.js";

function main(): void {
  const db = getDatabase();
  const users = new UserRepository(db);
  const memory = new MemoryRepository(db);

  const user = users.findOrCreateByLoginName("verify_memory");

  const created = memory.create({
    userId: user.id,
    fact: "Usuário prefere burger vegetariano",
    normalizedFact: "usuario prefere burger vegetariano",
    category: "preference",
    confidence: 0.9,
    sourceMessage: "Gosto de burger vegetariano",
  });

  const duplicate = memory.existsByNormalizedFact(
    user.id,
    "usuario prefere burger vegetariano",
  );
  const active = memory.findActiveByUserId(user.id);

  console.log("[verify:memory] user:", user.name, `(${user.id})`);
  console.log("[verify:memory] created id:", created.id);
  console.log("[verify:memory] duplicate check:", duplicate);
  console.log("[verify:memory] active facts:", active.length);
  for (const fact of active) {
    console.log(`  - ${fact.fact} [${fact.category}]`);
  }

  closeDatabase();
}

main();
