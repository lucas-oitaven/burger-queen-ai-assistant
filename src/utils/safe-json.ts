/**
 * Tenta interpretar JSON retornado por LLM (com ou sem cercas markdown).
 * Retorna `null` se nenhum trecho for JSON válido.
 */
export function parseJsonSafe(raw: string): unknown | null {
  for (const candidate of collectJsonCandidates(raw)) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      continue;
    }
  }

  return null;
}

function collectJsonCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  const candidates: string[] = [];

  if (trimmed) {
    candidates.push(trimmed);
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    candidates.push(fenced[1].trim());
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return [...new Set(candidates)];
}
