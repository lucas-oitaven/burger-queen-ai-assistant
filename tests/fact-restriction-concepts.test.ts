import { describe, expect, it } from "vitest";
import { normalizeFactForDedup } from "../src/modules/memory/fact-normalize.js";
import { FactDeduplicatorService } from "../src/modules/memory/fact-deduplicator.service.js";
import {
  buildDietaryRagQuerySuffix,
  detectDietaryRestrictionConcepts,
  enrichRagQueryWithUserDiet,
  sharesDietaryRestrictionConcept,
} from "../src/modules/memory/fact-restriction-concepts.js";
import { classifyIntentFallback } from "../src/modules/llm/intent-fallback.classifier.js";

describe("fact-restriction-concepts", () => {
  it("detects vegetarian concept in seeded Carla fact", () => {
    const concepts = detectDietaryRestrictionConcepts(
      "É vegetariana (prefere Grão Nobre, Caprese Veg e opções da linha veggie).",
    );

    expect(concepts.has("vegetarian")).toBe(true);
  });

  it("treats seeded and extracted vegetarian facts as the same concept", () => {
    const seeded = normalizeFactForDedup(
      "É vegetariana (prefere Grão Nobre, Caprese Veg e opções da linha veggie).",
    );
    const extracted = normalizeFactForDedup("Usuário é vegetariana");

    expect(sharesDietaryRestrictionConcept(seeded, extracted)).toBe(true);
  });

  it("builds RAG suffix for vegetarian users", () => {
    const suffix = buildDietaryRagQuerySuffix([
      { fact: "É vegetariana (prefere Grão Nobre, Caprese Veg e opções da linha veggie)." },
    ]);

    expect(suffix).toContain("vegetarianas");
    expect(suffix).toContain("veggie");
  });

  it("enriches recommendation query with dietary context", () => {
    const enriched = enrichRagQueryWithUserDiet(
      "user-1",
      "quero uma recomendação",
      {
        listActiveFacts: () => [
          {
            fact: "É vegetariana (prefere Grão Nobre, Caprese Veg e opções da linha veggie).",
          },
        ],
      },
    );

    expect(enriched).toContain("quero uma recomendação");
    expect(enriched).toContain("vegetarianas");
  });
});

describe("FactDeduplicatorService — dietary restrictions", () => {
  it("skips extracted vegetarian fact when seeded restriction exists", () => {
    const dedup = new FactDeduplicatorService({
      existsByNormalizedFact: () => false,
      findActiveByUserId: () => [
        {
          id: "1",
          userId: "carla",
          fact: "É vegetariana (prefere Grão Nobre, Caprese Veg e opções da linha veggie).",
          normalizedFact: normalizeFactForDedup(
            "É vegetariana (prefere Grão Nobre, Caprese Veg e opções da linha veggie).",
          ),
          category: "restriction",
          confidence: 0.95,
          sourceMessage: "seed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true,
        },
      ],
    } as never);

    expect(
      dedup.isDuplicate(
        "carla",
        "Usuário é vegetariana",
      ),
    ).toBe(true);
  });
});

describe("classifyIntentFallback — recommendations load user facts", () => {
  it("loads user facts for quero uma recomendação", () => {
    const result = classifyIntentFallback("quero uma recomendação");

    expect(result.intent).toBe("general_recommendation");
    expect(result.needsRag).toBe(true);
    expect(result.needsUserFacts).toBe(true);
    expect(result.shouldExtractFacts).toBe(false);
  });
});
