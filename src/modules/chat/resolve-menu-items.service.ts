import { normalizeMessageForMatch } from "../llm/intent-fallback.classifier.js";
import type { RagResult } from "../rag/rag.types.js";
import type { OrderDraftItem } from "./conversation-stage.types.js";
import type { ResolvedMenuItem } from "./resolve-menu-items.types.js";

const PRICE_PATTERN = /R\$\s*\d+/;

/** Extrai nomes e preços dos trechos recuperados da knowledge base. */
export function extractMenuCatalogFromRag(chunks: RagResult[]): ResolvedMenuItem[] {
  const byName = new Map<string, ResolvedMenuItem>();

  for (const chunk of chunks) {
    const source = chunk.sourcePath ?? chunk.source;
    ingestCatalogText(chunk.content, source, byName);
  }

  return [...byName.values()].sort((a, b) => b.name.length - a.name.length);
}

function ingestCatalogText(
  content: string,
  source: string | undefined,
  byName: Map<string, ResolvedMenuItem>,
): void {
  for (const match of content.matchAll(
    /\|\s*\*\*([^*]+)\*\*[^|\n]*\|[^|\n]*\|\s*(R\$\s*\d+)/gi,
  )) {
    addCatalogEntry(byName, match[1]?.trim() ?? "", match[2]?.trim() ?? "", source);
  }

  for (const match of content.matchAll(
    /\|\s*([^|*\n][^|\n]+?)\s*\|\s*[^|\n]+\s*\|\s*(R\$\s*\d+)/g,
  )) {
    const name = match[1]?.trim() ?? "";
    if (name.length < 2 || /^item$/i.test(name)) {
      continue;
    }
    addCatalogEntry(byName, name, match[2]?.trim() ?? "", source);
  }

  const sections = content.split(/^###\s+/gm);
  for (const section of sections.slice(1)) {
    const title = section.split("\n")[0]?.trim();
    if (!title) {
      continue;
    }
    const priceMatch = section.match(/\*\*Pre[cç]o:\*\*\s*(R\$\s*\d+)/i);
    if (priceMatch) {
      addCatalogEntry(byName, title, priceMatch[1] ?? "", source);
    }
  }

  for (const match of content.matchAll(/\*\*([^*]+)\*\*/g)) {
    const name = match[1]?.trim() ?? "";
    if (!name || name.length < 4 || !looksLikeMenuItemName(name)) {
      continue;
    }
    const window = content.slice(
      Math.max(0, (match.index ?? 0) - 40),
      (match.index ?? 0) + 120,
    );
    const nearPrice = window.match(PRICE_PATTERN);
    if (nearPrice) {
      addCatalogEntry(byName, name, nearPrice[0], source);
    }
  }
}

function looksLikeMenuItemName(name: string): boolean {
  if (/^(pre[cç]o|observa|al[eé]rgeno|ingrediente|blend|p[aã]o)/i.test(name)) {
    return false;
  }
  return /(?:combo|burger|veg|nobre|classic|smash|guaran|cola|batata|trufa|bacon|caprese|gr[aã]o)/i.test(
    name,
  );
}

function stripMarkdownName(name: string): string {
  return name.replace(/\*\*/g, "").trim();
}

function addCatalogEntry(
  byName: Map<string, ResolvedMenuItem>,
  name: string,
  priceHint: string,
  source: string | undefined,
): void {
  const cleanName = stripMarkdownName(name);
  if (!cleanName || !PRICE_PATTERN.test(priceHint)) {
    return;
  }
  const key = normalizeMessageForMatch(cleanName);
  if (!key) {
    return;
  }
  const existing = [...byName.entries()].find(
    ([k]) => k === key || k.includes(key) || key.includes(k),
  );
  if (existing && existing[1].name.length >= cleanName.length) {
    return;
  }
  byName.set(key, { name: cleanName, priceHint, source });
}

/** Match por tokens (tolera typos como "veggier" → "veggie"). */
export function messageTokensMatchCatalogItem(
  text: string,
  normalizedItemName: string,
): boolean {
  const nameTokens = normalizedItemName.split(" ").filter((t) => t.length >= 3);
  if (nameTokens.length === 0) {
    return false;
  }

  const textWords = text.split(" ");
  let hits = 0;

  for (const token of nameTokens) {
    if (text.includes(token)) {
      hits += 1;
      continue;
    }
    const prefix = token.slice(0, Math.min(5, token.length));
    if (
      textWords.some(
        (word) =>
          word.length >= 4 &&
          (word.startsWith(prefix) || prefix.startsWith(word.slice(0, 5))),
      )
    ) {
      hits += 1;
    }
  }

  return hits >= Math.max(2, nameTokens.length - 1);
}

/** Itens do catálogo RAG mencionados na mensagem do cliente. */
export function matchMessageToResolvedMenu(
  message: string,
  catalog: ResolvedMenuItem[],
): ResolvedMenuItem[] {
  const text = normalizeMessageForMatch(message);
  if (!text || catalog.length === 0) {
    return [];
  }

  const found: ResolvedMenuItem[] = [];

  for (const item of catalog) {
    const normalized = normalizeMessageForMatch(item.name);
    if (normalized && text.includes(normalized)) {
      found.push(item);
      continue;
    }
    if (messageTokensMatchCatalogItem(text, normalized)) {
      found.push(item);
    }
  }

  if (/\bguarana\b/.test(text)) {
    const guarana = catalog.find((item) =>
      normalizeMessageForMatch(item.name).includes("guarana"),
    );
    if (guarana && !found.some((f) => f.name === guarana.name)) {
      found.push(guarana);
    }
  }

  return dropNestedResolvedItems(found);
}

function dropNestedResolvedItems(items: ResolvedMenuItem[]): ResolvedMenuItem[] {
  return items.filter((item) => {
    const normalized = normalizeMessageForMatch(item.name);
    return !items.some((other) => {
      if (other.name === item.name || other.name.length <= item.name.length) {
        return false;
      }
      return normalizeMessageForMatch(other.name).includes(normalized);
    });
  });
}

export function mergeResolvedItemsIntoDraft(
  draftOrder: OrderDraftItem[],
  resolved: ResolvedMenuItem[],
): OrderDraftItem[] {
  let next = [...draftOrder];
  for (const item of resolved) {
    next = upsertDraftItem(next, item);
  }
  return next;
}

function upsertDraftItem(
  draftOrder: OrderDraftItem[],
  item: ResolvedMenuItem,
): OrderDraftItem[] {
  const key = normalizeMessageForMatch(item.name);
  const existing = draftOrder.find(
    (row) => normalizeMessageForMatch(row.name) === key,
  );

  if (existing) {
    return draftOrder.map((row) =>
      row === existing
        ? {
            ...row,
            quantity: row.quantity + 1,
            priceHint: row.priceHint ?? item.priceHint,
            source: row.source ?? item.source,
          }
        : row,
    );
  }

  return [
    ...draftOrder,
    {
      name: item.name,
      quantity: 1,
      priceHint: item.priceHint,
      source: item.source,
    },
  ];
}

export function ensureDraftOrderPrices(
  draftOrder: OrderDraftItem[],
): OrderDraftItem[] {
  return draftOrder;
}
