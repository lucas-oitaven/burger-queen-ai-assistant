/**
 * Normalização estável para `normalized_fact` e comparação de duplicatas.
 */
export function normalizeFactForDedup(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeNormalizedFact(normalized: string): string[] {
  if (!normalized) {
    return [];
  }
  return normalized.split(" ").filter((token) => token.length > 0);
}
