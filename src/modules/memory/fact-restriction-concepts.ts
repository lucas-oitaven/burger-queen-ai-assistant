export type DietaryRestrictionConcept =
  | "vegetarian"
  | "vegan"
  | "lactose_free"
  | "gluten_free";

const CONCEPT_PATTERNS: Record<DietaryRestrictionConcept, RegExp[]> = {
  vegetarian: [
    /\bvegetar/i,
    /\bveggie\b/i,
    /\bsem\s+carne\b/i,
    /\bnao\s+come\s+carne\b/i,
  ],
  vegan: [/\bvegan/i, /\bplant\s+based\b/i],
  lactose_free: [
    /\bsem\s+lactose\b/i,
    /\bintoleran\w*\s+a\s+lactose\b/i,
    /\blactose\s+free\b/i,
  ],
  gluten_free: [/\bsem\s+gluten\b/i, /\bceliac/i, /\bcel[ií]ac/i],
};

export function detectDietaryRestrictionConcepts(text: string): Set<DietaryRestrictionConcept> {
  const normalized = text.toLowerCase();
  const concepts = new Set<DietaryRestrictionConcept>();

  for (const [concept, patterns] of Object.entries(CONCEPT_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      concepts.add(concept as DietaryRestrictionConcept);
    }
  }

  return concepts;
}

/** Dois fatos expressam a mesma restrição alimentar (ex.: "É vegetariana…" vs "Usuário é vegetariana"). */
export function sharesDietaryRestrictionConcept(a: string, b: string): boolean {
  const conceptsA = detectDietaryRestrictionConcepts(a);
  if (conceptsA.size === 0) {
    return false;
  }

  const conceptsB = detectDietaryRestrictionConcepts(b);
  for (const concept of conceptsA) {
    if (conceptsB.has(concept)) {
      return true;
    }
  }

  return false;
}

export function hasDietaryRestrictionsInFacts(
  facts: ReadonlyArray<{ fact: string; category?: string | null }>,
): boolean {
  return facts.some(
    (fact) =>
      fact.category === "restriction" ||
      detectDietaryRestrictionConcepts(fact.fact).size > 0,
  );
}

export function buildDietaryRagQuerySuffix(
  facts: ReadonlyArray<{ fact: string }>,
): string {
  const combined = facts.map((fact) => fact.fact).join(" ");
  const concepts = detectDietaryRestrictionConcepts(combined);
  const parts: string[] = [];

  if (concepts.has("vegetarian")) {
    parts.push("opções vegetarianas veggie linha veggie");
  }
  if (concepts.has("vegan")) {
    parts.push("opções veganas");
  }
  if (concepts.has("lactose_free")) {
    parts.push("sem lactose");
  }
  if (concepts.has("gluten_free")) {
    parts.push("sem glúten");
  }

  return parts.join(" ");
}

export function enrichRagQueryWithUserDiet(
  userId: string,
  query: string,
  memoryService: { listActiveFacts(userId: string): ReadonlyArray<{ fact: string }> },
): string {
  const facts = memoryService.listActiveFacts(userId);
  const suffix = buildDietaryRagQuerySuffix(facts);
  if (!suffix) {
    return query;
  }

  return `${query.trim()} ${suffix}`.trim();
}
