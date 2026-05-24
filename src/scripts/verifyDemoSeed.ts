/**
 * Smoke test Issue #11 Parte 11.3 — seed demo users + isolamento de fatos.
 * Uso: npm run verify:demo-seed
 */
import { closeDatabase, getDatabase } from "../database/sqlite.js";
import { normalizeFactForDedup } from "../modules/memory/fact-normalize.js";
import { MemoryRepository } from "../modules/memory/memory.repository.js";
import type { UserFact } from "../modules/memory/memory.types.js";
import { UserRepository } from "../modules/users/user.repository.js";
import { DEMO_USER_PERSONAS } from "./demo-users.seed-data.js";
import { seedDemoUsers } from "./seedDemoUsers.js";

const DEMO_LOGINS = ["ana", "bruno", "carla"] as const;

type DemoLogin = (typeof DEMO_LOGINS)[number];

function assertLabel(label: string, ok: boolean): boolean {
  console.log(`[verify:demo-seed] ${ok ? "OK" : "FAIL"} — ${label}`);
  return ok;
}

function normalizeFactText(text: string): string {
  return normalizeFactForDedup(text);
}

function combinedFactText(facts: UserFact[]): string {
  return normalizeFactText(facts.map((f) => f.fact).join(" "));
}

function hasKeyword(text: string, keyword: string): boolean {
  return text.includes(keyword);
}

function personaKeywordsOk(login: DemoLogin, text: string): boolean {
  switch (login) {
    case "ana":
      return (
        hasKeyword(text, "lactose") &&
        (hasKeyword(text, "artesan") || hasKeyword(text, "queen classic"))
      );
    case "bruno":
      return hasKeyword(text, "smash") && hasKeyword(text, "combo");
    case "carla":
      return hasKeyword(text, "vegetar") && hasKeyword(text, "leve");
    default:
      return false;
  }
}

function factsAreIsolated(
  byLogin: Record<DemoLogin, UserFact[]>,
): boolean {
  const normalizedByUser: Record<DemoLogin, Set<string>> = {
    ana: new Set(),
    bruno: new Set(),
    carla: new Set(),
  };

  for (const login of DEMO_LOGINS) {
    for (const fact of byLogin[login]) {
      const key = fact.normalizedFact ?? normalizeFactText(fact.fact);
      if (key) {
        normalizedByUser[login].add(key);
      }
    }
  }

  for (const loginA of DEMO_LOGINS) {
    for (const loginB of DEMO_LOGINS) {
      if (loginA === loginB) {
        continue;
      }
      for (const normalized of normalizedByUser[loginA]) {
        if (normalizedByUser[loginB].has(normalized)) {
          return false;
        }
      }
    }
  }

  return true;
}

function main(): void {
  let passed = 0;
  let total = 0;

  const seedResult = seedDemoUsers();
  total += 1;
  if (
    assertLabel(
      "seed executado (3 personas no catálogo)",
      seedResult.usersEnsured === DEMO_USER_PERSONAS.length,
    )
  ) {
    passed += 1;
  }

  const db = getDatabase();
  const users = new UserRepository(db);
  const memory = new MemoryRepository(db);

  const byLogin = {} as Record<DemoLogin, UserFact[]>;
  const userIds = {} as Record<DemoLogin, string>;

  for (const login of DEMO_LOGINS) {
    const user = users.findByLoginName(login);
    total += 1;
    if (assertLabel(`usuário existe — ${login}`, user !== null)) {
      passed += 1;
    }

    if (!user) {
      byLogin[login] = [];
      continue;
    }

    userIds[login] = user.id;
    byLogin[login] = memory.findActiveByUserId(user.id);
  }

  for (const login of DEMO_LOGINS) {
    const facts = byLogin[login];
    const expectedCount =
      DEMO_USER_PERSONAS.find((p) => p.loginName === login)?.facts.length ?? 2;

    total += 1;
    if (
      assertLabel(
        `${login} — ≥ ${expectedCount} fatos ativos`,
        facts.length >= expectedCount,
      )
    ) {
      passed += 1;
    }

    total += 1;
    const text = combinedFactText(facts);
    if (assertLabel(`${login} — palavras-chave do perfil`, personaKeywordsOk(login, text))) {
      passed += 1;
    }
  }

  total += 1;
  if (assertLabel("isolamento — normalized_fact não compartilhado", factsAreIsolated(byLogin))) {
    passed += 1;
  }

  total += 1;
  const distinctIds =
    new Set([userIds.ana, userIds.bruno, userIds.carla].filter(Boolean)).size ===
    3;
  if (assertLabel("isolamento — três user_id distintos", distinctIds)) {
    passed += 1;
  }

  console.log(`\n[verify:demo-seed] ${passed}/${total} checks passed`);

  closeDatabase();

  if (passed !== total) {
    process.exitCode = 1;
  }
}

main();
