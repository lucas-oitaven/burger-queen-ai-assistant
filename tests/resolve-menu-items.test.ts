import { describe, expect, it } from "vitest";
import {
  extractMenuCatalogFromRag,
  matchMessageToResolvedMenu,
} from "../src/modules/chat/resolve-menu-items.service.js";
import type { RagResult } from "../src/modules/rag/rag.types.js";

const COMBO_CHUNK: RagResult = {
  source: "09-combos-promocoes.md",
  content: `| **Combo Queen Classic** | Queen Classic | R$ 58 | R$ 66 |
| **Combo Veggie Artesanal** | Grão Nobre | R$ 52 | R$ 60 |`,
};

const BURGER_CHUNK: RagResult = {
  source: "02-burgers-assinatura.md",
  content: `### Caprese Veg
- **Preço:** R$ 38
- **Alérgenos:** glúten`,
};

const DRINK_CHUNK: RagResult = {
  source: "10-bebidas-sobremesas.md",
  content: `| Guaraná | 350 ml | R$ 8 | Não | Não |`,
};

describe("resolve-menu-items", () => {
  it("extracts combo and burger prices from RAG chunks", () => {
    const catalog = extractMenuCatalogFromRag([
      COMBO_CHUNK,
      BURGER_CHUNK,
      DRINK_CHUNK,
    ]);

    const names = catalog.map((item) => item.name);
    expect(names).toContain("Combo Queen Classic");
    expect(names).toContain("Caprese Veg");
    expect(names).toContain("Guaraná");

    const combo = catalog.find((item) => item.name === "Combo Queen Classic");
    expect(combo?.priceHint).toBe("R$ 58");
  });

  it("matches user message without nested Queen Classic", () => {
    const catalog = extractMenuCatalogFromRag([COMBO_CHUNK, DRINK_CHUNK]);
    const matched = matchMessageToResolvedMenu(
      "quero o combo queen classic com guaraná",
      catalog,
    );

    expect(matched.map((i) => i.name)).toContain("Combo Queen Classic");
    expect(matched.map((i) => i.name)).not.toContain("Queen Classic");
    expect(matched.map((i) => i.name)).toContain("Guaraná");
  });
});
