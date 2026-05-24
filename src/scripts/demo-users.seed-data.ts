import type { FactCategory } from "../modules/memory/memory.types.js";

/** Fato curado para `npm run seed:demo` (Issue #11 — sem extração LLM). */
export type DemoUserSeedFact = {
  fact: string;
  category: FactCategory;
  confidence: number;
  sourceMessage: string;
};

/** Persona demo: login estável (`/login ana`) + fatos iniciais no SQLite. */
export type DemoUserPersona = {
  loginName: string;
  displayName: string;
  facts: DemoUserSeedFact[];
};

const SEED_SOURCE = "[seed:demo]";

/** Confiança fixa para fatos curados (>= MIN_FACT_CONFIDENCE 0.7). */
const SEED_CONFIDENCE = 0.9;

/**
 * Catálogo oficial das personas demo (Issue #11.1).
 * Alinhado aos critérios GitHub e à knowledge-base/.
 */
export const DEMO_USER_PERSONAS: DemoUserPersona[] = [
  {
    loginName: "ana",
    displayName: "Ana",
    facts: [
      {
        fact: "Cliente evita lactose e prefere hambúrgueres sem lactose ou com adaptação sem lactose (+R$ 4).",
        category: "restriction",
        confidence: SEED_CONFIDENCE,
        sourceMessage: `${SEED_SOURCE} persona ana`,
      },
      {
        fact: "Prefere a linha de burgers artesanais da casa (Queen Classic, Trufa Nobre, Picante da Casa).",
        category: "preference",
        confidence: SEED_CONFIDENCE,
        sourceMessage: `${SEED_SOURCE} persona ana`,
      },
    ],
  },
  {
    loginName: "bruno",
    displayName: "Bruno",
    facts: [
      {
        fact: "Prefere hambúrgueres suculentos da linha smash (Single Smash, Smash Duplo, Smash Picante).",
        category: "preference",
        confidence: SEED_CONFIDENCE,
        sourceMessage: `${SEED_SOURCE} persona bruno`,
      },
      {
        fact: "Gosta de pedir combos, especialmente da linha smash (Combo Smash Duplo).",
        category: "habit",
        confidence: SEED_CONFIDENCE,
        sourceMessage: `${SEED_SOURCE} persona bruno`,
      },
    ],
  },
  {
    loginName: "carla",
    displayName: "Carla",
    facts: [
      {
        fact: "É vegetariana (prefere Grão Nobre, Caprese Veg e opções da linha veggie).",
        category: "restriction",
        confidence: SEED_CONFIDENCE,
        sourceMessage: `${SEED_SOURCE} persona carla`,
      },
      {
        fact: "Prefere opções mais leves: salada, Combo Veggie Artesanal ou porções menores.",
        category: "preference",
        confidence: SEED_CONFIDENCE,
        sourceMessage: `${SEED_SOURCE} persona carla`,
      },
    ],
  },
];
