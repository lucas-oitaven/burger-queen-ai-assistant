export function formatDisplayName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeLoginName(raw: string): string {
  return raw.trim().toLowerCase();
}
