/**
 * Persiste usuários demo (Ana, Bruno, Carla) e fatos iniciais no SQLite.
 * Issue #11.2 — idempotente, sem OpenAI.
 */
import { closeDatabase, getDatabase } from "../database/sqlite.js";
import { normalizeFactForDedup } from "../modules/memory/fact-normalize.js";
import { MemoryRepository } from "../modules/memory/memory.repository.js";
import { UserRepository } from "../modules/users/user.repository.js";
import {
  DEMO_USER_PERSONAS,
  type DemoUserPersona,
} from "./demo-users.seed-data.js";

export type SeedDemoUsersResult = {
  usersEnsured: number;
  factsInserted: number;
  factsSkipped: number;
};

export function seedDemoUsers(): SeedDemoUsersResult {
  const db = getDatabase();
  const users = new UserRepository(db);
  const memory = new MemoryRepository(db);

  let factsInserted = 0;
  let factsSkipped = 0;

  for (const persona of DEMO_USER_PERSONAS) {
    const user = users.findOrCreateByLoginName(persona.loginName);

    if (user.name !== persona.displayName) {
      console.log(
        `[seed:demo] Aviso: login ${persona.loginName} já existe como "${user.name}" (esperado "${persona.displayName}").`,
      );
    }

    for (const seedFact of persona.facts) {
      const normalizedFact = normalizeFactForDedup(seedFact.fact);
      if (!normalizedFact) {
        console.warn(
          `[seed:demo] Fato vazio ignorado para ${persona.loginName}.`,
        );
        continue;
      }

      if (memory.existsByNormalizedFact(user.id, normalizedFact)) {
        factsSkipped += 1;
        continue;
      }

      memory.create({
        userId: user.id,
        fact: seedFact.fact,
        normalizedFact,
        category: seedFact.category,
        confidence: seedFact.confidence,
        sourceMessage: seedFact.sourceMessage,
      });
      factsInserted += 1;
    }
  }

  return {
    usersEnsured: DEMO_USER_PERSONAS.length,
    factsInserted,
    factsSkipped,
  };
}

function logPersonaSummary(persona: DemoUserPersona): void {
  console.log(
    `  ${persona.loginName} (${persona.displayName}) — ${persona.facts.length} fatos no catálogo`,
  );
}

async function main(): Promise<void> {
  console.log("[seed:demo] Burger Queen — usuários e fatos de demonstração\n");

  const startedAt = Date.now();
  const result = seedDemoUsers();
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log("[seed:demo] Personas:");
  for (const persona of DEMO_USER_PERSONAS) {
    logPersonaSummary(persona);
  }

  console.log("\n[seed:demo] Resumo");
  console.log(`  Personas no catálogo:     ${result.usersEnsured}`);
  console.log(`  Fatos inseridos agora:    ${result.factsInserted}`);
  console.log(`  Fatos já existentes:      ${result.factsSkipped}`);
  console.log(`  Tempo:                    ${elapsedSec}s`);
  console.log(
    "\n[seed:demo] Use /login ana | bruno | carla e /facts no npm run chat.",
  );
  console.log("[seed:demo] Concluído com sucesso.");
}

main()
  .catch((error: unknown) => {
    console.error("\n[seed:demo] Falha no seed.");

    if (error instanceof Error) {
      console.error(`[seed:demo] ${error.message}`);
    } else {
      console.error(error);
    }

    process.exit(1);
  })
  .finally(() => {
    closeDatabase();
  });
