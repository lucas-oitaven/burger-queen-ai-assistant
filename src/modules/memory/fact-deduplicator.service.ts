import type { MemoryRepository } from "./memory.repository.js";
import {
  normalizeFactForDedup,
  tokenizeNormalizedFact,
} from "./fact-normalize.js";
import { sharesDietaryRestrictionConcept } from "./fact-restriction-concepts.js";
import type { CandidateFact, UserFact } from "./memory.types.js";

/** Limiar Jaccard entre tokens para considerar fatos equivalentes (MVP). */
const SIMILARITY_JACCARD_THRESHOLD = 0.85;

export type FactDedupSkipReason = "duplicate_existing" | "duplicate_batch";

export type DedupedCandidateFact = {
  candidate: CandidateFact;
  normalizedFact: string;
};

export type SkippedCandidateFact = {
  candidate: CandidateFact;
  normalizedFact: string;
  reason: FactDedupSkipReason;
};

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) {
    return 1;
  }
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;

  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function areNormalizedFactsSimilar(a: string, b: string): boolean {
  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  const tokensA = tokenizeNormalizedFact(a);
  const tokensB = tokenizeNormalizedFact(b);

  if (jaccardSimilarity(tokensA, tokensB) >= SIMILARITY_JACCARD_THRESHOLD) {
    return true;
  }

  const minLength = 12;
  if (a.length >= minLength && b.length >= minLength) {
    if (a.includes(b) || b.includes(a)) {
      return true;
    }
  }

  if (sharesDietaryRestrictionConcept(a, b)) {
    return true;
  }

  return false;
}

function matchesAnyNormalized(
  normalized: string,
  others: string[],
): boolean {
  return others.some((other) => areNormalizedFactsSimilar(normalized, other));
}

export class FactDeduplicatorService {
  constructor(private readonly memoryRepository: MemoryRepository) {}

  normalizeFact(fact: string): string {
    return normalizeFactForDedup(fact);
  }

  /**
   * Verifica duplicata exata (SQLite) ou similaridade simples com fatos ativos.
   */
  isDuplicate(userId: string, factText: string): boolean {
    const normalized = this.normalizeFact(factText);
    if (!normalized) {
      return true;
    }

    if (this.memoryRepository.existsByNormalizedFact(userId, normalized)) {
      return true;
    }

    const active = this.memoryRepository.findActiveByUserId(userId);
    const existingNormalized = active
      .map((row) => row.normalizedFact)
      .filter((value): value is string => value !== null && value.length > 0);

    return matchesAnyNormalized(normalized, existingNormalized);
  }

  /**
   * Filtra candidatos já presentes no banco ou repetidos no mesmo lote.
   */
  filterNovel(
    userId: string,
    candidates: CandidateFact[],
  ): { novel: DedupedCandidateFact[]; skipped: SkippedCandidateFact[] } {
    const active = this.memoryRepository.findActiveByUserId(userId);
    const existingNormalized = this.collectNormalizedFromFacts(active);

    const novel: DedupedCandidateFact[] = [];
    const skipped: SkippedCandidateFact[] = [];
    const batchNormalized: string[] = [];

    for (const candidate of candidates) {
      const normalized = this.normalizeFact(candidate.fact);

      if (!normalized) {
        continue;
      }

      if (matchesAnyNormalized(normalized, existingNormalized)) {
        skipped.push({
          candidate,
          normalizedFact: normalized,
          reason: "duplicate_existing",
        });
        continue;
      }

      if (matchesAnyNormalized(normalized, batchNormalized)) {
        skipped.push({
          candidate,
          normalizedFact: normalized,
          reason: "duplicate_batch",
        });
        continue;
      }

      novel.push({ candidate, normalizedFact: normalized });
      batchNormalized.push(normalized);
    }

    return { novel, skipped };
  }

  private collectNormalizedFromFacts(facts: UserFact[]): string[] {
    return facts
      .map((row) => row.normalizedFact)
      .filter((value): value is string => value !== null && value.length > 0);
  }
}
