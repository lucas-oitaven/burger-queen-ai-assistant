import { describe, expect, it } from "vitest";
import {
  RAG_MAX_DISTANCE,
  RAG_WEAK_RESULT_SLACK,
} from "../src/modules/rag/rag.config.js";
import {
  buildRagDebugSnapshot,
  filterWeakRagResults,
  formatRagDebugLines,
  searchKnowledgeBase,
} from "../src/modules/rag/rag.service.js";
import type { RagResult } from "../src/modules/rag/rag.types.js";

function makeResult(
  partial: Partial<RagResult> & Pick<RagResult, "source">,
): RagResult {
  return {
    content: partial.content ?? "chunk content",
    source: partial.source,
    score: partial.score,
    sourcePath: partial.sourcePath,
    chunkIndex: partial.chunkIndex,
  };
}

describe("filterWeakRagResults", () => {
  const maxDistance = 1.0;

  it("keeps chunks at or below maxDistance", () => {
    const results: RagResult[] = [
      makeResult({ source: "menu.md", score: 0.7 }),
      makeResult({ source: "vegan.md", score: 0.95 }),
    ];

    const filtered = filterWeakRagResults(results, maxDistance);

    expect(filtered).toHaveLength(2);
  });

  it("drops chunks above maxDistance when stronger matches exist", () => {
    const results: RagResult[] = [
      makeResult({ source: "good.md", score: 0.8 }),
      makeResult({ source: "weak.md", score: 1.5 }),
    ];

    const filtered = filterWeakRagResults(results, maxDistance);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.source).toBe("good.md");
  });

  it("keeps chunks without score (conservative)", () => {
    const results: RagResult[] = [
      makeResult({ source: "no-score.md" }),
      makeResult({ source: "scored.md", score: 2.0 }),
    ];

    const filtered = filterWeakRagResults(results, maxDistance);

    expect(filtered.map((r) => r.source)).toContain("no-score.md");
  });

  it("returns best weak chunk within slack when all exceed maxDistance", () => {
    const weakCap = maxDistance + RAG_WEAK_RESULT_SLACK;
    const results: RagResult[] = [
      makeResult({ source: "far.md", score: weakCap + 0.1 }),
      makeResult({ source: "best-weak.md", score: weakCap }),
    ];

    const filtered = filterWeakRagResults(results, maxDistance);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.source).toBe("best-weak.md");
  });

  it("returns empty when all scored chunks are beyond maxDistance + slack", () => {
    const results: RagResult[] = [
      makeResult({ source: "a.md", score: 2.0 }),
      makeResult({ source: "b.md", score: 2.5 }),
    ];

    expect(filterWeakRagResults(results, maxDistance)).toEqual([]);
  });

  it("returns original list when every chunk lacks score", () => {
    const results: RagResult[] = [
      makeResult({ source: "a.md" }),
      makeResult({ source: "b.md" }),
    ];

    expect(filterWeakRagResults(results, maxDistance)).toEqual(results);
  });

  it("uses RAG_MAX_DISTANCE by default", () => {
    const borderline = makeResult({
      source: "border.md",
      score: RAG_MAX_DISTANCE,
    });

    expect(filterWeakRagResults([borderline])).toHaveLength(1);
  });
});

describe("buildRagDebugSnapshot", () => {
  it("marks usedRag and deduplicates retrieved doc names", () => {
    const results: RagResult[] = [
      makeResult({ source: "06-opcoes-vegetarianas.md", score: 0.8 }),
      makeResult({ source: "06-opcoes-vegetarianas.md", score: 0.9 }),
      makeResult({ source: "01-cardapio.md", score: 0.85 }),
    ];

    const snapshot = buildRagDebugSnapshot("opções veganas", results);

    expect(snapshot.usedRag).toBe(true);
    expect(snapshot.query).toBe("opções veganas");
    expect(snapshot.retrievedDocs).toEqual([
      "01-cardapio.md",
      "06-opcoes-vegetarianas.md",
    ]);
    expect(snapshot.results).toHaveLength(3);
    expect(snapshot.notice).toBeUndefined();
  });

  it("sets notice when no chunks are available", () => {
    const snapshot = buildRagDebugSnapshot("   ", []);

    expect(snapshot.usedRag).toBe(false);
    expect(snapshot.retrievedDocs).toEqual([]);
    expect(snapshot.notice).toContain("No relevant knowledge base chunks");
  });
});

describe("formatRagDebugLines", () => {
  it("formats usedRag, doc list, and per-chunk scores", () => {
    const snapshot = buildRagDebugSnapshot("horários", [
      makeResult({
        source: "02-horarios.md",
        score: 1.02,
        chunkIndex: 0,
      }),
    ]);

    const lines = formatRagDebugLines(snapshot);

    expect(lines[0]).toBe("Used RAG: true");
    expect(lines).toContain("Retrieved docs:");
    expect(lines).toContain("- 02-horarios.md");
    expect(lines.some((line) => line.includes("[02-horarios.md#0]"))).toBe(
      true,
    );
    expect(lines.some((line) => line.includes("score=1.0200"))).toBe(true);
  });

  it("includes notice line when snapshot has no results", () => {
    const snapshot = buildRagDebugSnapshot("oi", []);
    const lines = formatRagDebugLines(snapshot);

    expect(lines[0]).toBe("Used RAG: false");
    expect(lines[1]).toContain("No relevant knowledge base chunks");
  });
});

describe("searchKnowledgeBase", () => {
  it("returns empty array for blank query without calling Chroma", async () => {
    await expect(searchKnowledgeBase("   ")).resolves.toEqual([]);
  });

  const runIntegration = process.env.RUN_RAG_INTEGRATION === "1";

  describe.skipIf(!runIntegration)("integration (RUN_RAG_INTEGRATION=1)", () => {
    it("retrieves knowledge base chunks for menu queries", async () => {
      const results = await searchKnowledgeBase(
        "Quais opções vegetarianas vocês têm?",
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.content.length).toBeGreaterThan(0);
    });
  });
});
