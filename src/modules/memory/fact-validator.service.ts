import {
  MIN_FACT_CONFIDENCE,
  type CandidateFact,
  type FactRejectionReason,
  isFactCategory,
} from "./memory.types.js";

export type FactValidationOutcome =
  | { accepted: true }
  | { accepted: false; reason: FactRejectionReason };

export type RejectedCandidateFact = {
  candidate: CandidateFact;
  reason: FactRejectionReason;
};

/** Frases de estado momentâneo — não devem virar memória longa. */
const TEMPORARY_PATTERNS: RegExp[] = [
  /\bhoje\b/i,
  /\bagora\b/i,
  /\bneste momento\b/i,
  /\bno momento\b/i,
  /\besta noite\b/i,
  /\besta manhã\b/i,
  /\bestou com (?:muita )?fome\b/i,
  /\bestou com sede\b/i,
  /\bestá (?:muito )?calor\b/i,
  /\bestá (?:muito )?frio\b/i,
  /\bacabei de\b/i,
];

/** Tentativas de injection, privilégio falso ou comando sobre o sistema. */
const UNSAFE_PATTERNS: RegExp[] = [
  /ignore\s+(?:suas\s+)?instru/i,
  /instru[çc][õo]es\s+anteriores/i,
  /alterar\s+(?:as\s+)?regras/i,
  /mudar\s+(?:as\s+)?regras/i,
  /desconto\s+vital[íi]cio/i,
  /\b(?:sou|finja\s+que\s+sou)\s+admin/i,
  /administrador\s+do\s+sistema/i,
  /finja\s+que\b/i,
  /delete\s+todos/i,
  /apague\s+todos/i,
  /todos\s+os\s+(?:lanches|burgers?|hamb[uú]rgueres?)\s+(?:s[ãa]o\s+)?gr[aá]tis/i,
  /de\s+gra[çc]a\s+para\s+(?:o\s+)?usu[aá]rio/i,
  /mem[oó]ria\s+de\s+outro\s+usu[aá]rio/i,
  /mostre\s+a\s+mem[oó]ria/i,
  /privil[eé]gio/i,
  /prompt\s+injection/i,
  /\bsystem\s+prompt\b/i,
];

function normalizeFactText(fact: string): string {
  return fact.trim();
}

function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function isTemporaryFactText(text: string): boolean {
  return matchesAnyPattern(text, TEMPORARY_PATTERNS);
}

function isUnsafeFactText(text: string): boolean {
  return matchesAnyPattern(text, UNSAFE_PATTERNS);
}

function isValidConfidence(confidence: number): boolean {
  return (
    Number.isFinite(confidence) &&
    confidence >= MIN_FACT_CONFIDENCE &&
    confidence <= 1
  );
}

export class FactValidatorService {
  validate(candidate: CandidateFact): FactValidationOutcome {
    const fact = normalizeFactText(candidate.fact);

    if (!fact) {
      return { accepted: false, reason: "empty_fact" };
    }

    if (!isFactCategory(candidate.category)) {
      return { accepted: false, reason: "invalid_category" };
    }

    if (!isValidConfidence(candidate.confidence)) {
      return { accepted: false, reason: "low_confidence" };
    }

    if (isTemporaryFactText(fact)) {
      return { accepted: false, reason: "temporary" };
    }

    if (isUnsafeFactText(fact)) {
      return { accepted: false, reason: "unsafe" };
    }

    return { accepted: true };
  }

  filterValid(candidates: CandidateFact[]): CandidateFact[] {
    return candidates.filter(
      (candidate) => this.validate(candidate).accepted,
    );
  }

  partition(candidates: CandidateFact[]): {
    valid: CandidateFact[];
    rejected: RejectedCandidateFact[];
  } {
    const valid: CandidateFact[] = [];
    const rejected: RejectedCandidateFact[] = [];

    for (const candidate of candidates) {
      const outcome = this.validate(candidate);
      if (outcome.accepted) {
        valid.push(candidate);
      } else {
        rejected.push({ candidate, reason: outcome.reason });
      }
    }

    return { valid, rejected };
  }
}
