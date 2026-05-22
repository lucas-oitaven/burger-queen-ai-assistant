/**
 * Valida FactExtractorService (Issue #7 Parte 7.5).
 * - Parser (safe-json + Zod): sempre roda, sem API.
 * - OpenAI: só se OPENAI_API_KEY estiver definida.
 * Uso: npm run verify:memory-extractor
 */
import { env } from "../config/env.js";
import {
  FactExtractorService,
  parseFactExtractionFromText,
} from "../modules/memory/fact-extractor.service.js";

function assertLabel(label: string, ok: boolean): boolean {
  console.log(`[verify:memory-extractor] ${ok ? "OK" : "FAIL"} — ${label}`);
  return ok;
}

async function main(): Promise<void> {
  let passed = 0;
  let total = 0;

  const parseCases: Array<{
    label: string;
    raw: string;
    expectCount: number;
    expectCategory?: string;
  }> = [
    {
      label: "parse — JSON válido",
      raw: `{"facts":[{"fact":"Usuário é vegetariano","category":"restriction","confidence":0.9}]}`,
      expectCount: 1,
      expectCategory: "restriction",
    },
    {
      label: "parse — markdown fence",
      raw: '```json\n{"facts":[{"fact":"Usuário gosta de cogumelos","category":"preference","confidence":0.85}]}\n```',
      expectCount: 1,
      expectCategory: "preference",
    },
    {
      label: "parse — JSON inválido",
      raw: "not json at all",
      expectCount: 0,
    },
    {
      label: "parse — categoria inválida ignorada",
      raw: `{"facts":[{"fact":"X","category":"invalid","confidence":0.9},{"fact":"Usuário evita bacon","category":"negative_preference","confidence":0.8}]}`,
      expectCount: 1,
      expectCategory: "negative_preference",
    },
    {
      label: "parse — facts vazio",
      raw: `{"facts":[]}`,
      expectCount: 0,
    },
  ];

  for (const testCase of parseCases) {
    total += 1;
    const facts = parseFactExtractionFromText(testCase.raw);
    const countOk = facts.length === testCase.expectCount;
    const categoryOk =
      testCase.expectCategory === undefined ||
      facts[0]?.category === testCase.expectCategory;
    const ok = countOk && categoryOk;

    if (assertLabel(testCase.label, ok)) {
      passed += 1;
    } else {
      console.log(
        `  expected count=${testCase.expectCount} category=${testCase.expectCategory ?? "-"}`,
      );
      console.log(`  got:`, facts);
    }
  }

  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.log(
      "\n[verify:memory-extractor] SKIP live OpenAI — OPENAI_API_KEY não definida",
    );
    console.log(
      `[verify:memory-extractor] ${passed}/${total} checks passed (parser only)`,
    );
    if (passed !== total) {
      process.exitCode = 1;
    }
    return;
  }

  const live = await runLiveChecks();
  passed += live.passed;
  total += live.total;

  console.log(
    `\n[verify:memory-extractor] ${passed}/${total} checks passed`,
  );

  if (passed !== total) {
    process.exitCode = 1;
  }
}

async function runLiveChecks(): Promise<{ passed: number; total: number }> {
  let passed = 0;
  let total = 0;
  const extractor = new FactExtractorService();

  total += 1;
  const empty = await extractor.extractFactsFromMessage("   ");
  if (assertLabel("live — mensagem vazia", empty.length === 0)) {
    passed += 1;
  }

  total += 1;
  const stable = await extractor.extractFactsFromMessage(
    "Sou vegetariana e gosto de hambúrguer com cogumelos.",
  );
  const stableOk =
    stable.length >= 1 &&
    stable.some(
      (fact) =>
        fact.confidence >= 0.7 &&
        (fact.category === "restriction" ||
          fact.category === "preference" ||
          fact.category === "habit"),
    );
  if (assertLabel("live — preferência/restrição estável", stableOk)) {
    passed += 1;
  } else {
    console.log("  got:", stable);
  }

  total += 1;
  const temporary = await extractor.extractFactsFromMessage(
    "Hoje está muito calor e estou com fome agora.",
  );
  const temporaryOk = temporary.length === 0;
  if (
    assertLabel(
      "live — mensagem temporária (0 fatos ideal)",
      temporaryOk,
    )
  ) {
    passed += 1;
  } else {
    console.log(
      "  nota: se o modelo extrair algo, o validador (7.3) bloqueia na persistência",
    );
    console.log("  got:", temporary);
  }

  return { passed, total };
}

void main();
