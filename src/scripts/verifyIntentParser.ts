/**
 * Valida parse + LLM de intenção (Issue #8 Parte 8.3).
 * - Parser: sempre roda, sem API.
 * - OpenAI: só se OPENAI_API_KEY estiver definida.
 * Uso: npm run verify:intent
 */
import { env } from "../config/env.js";
import { IntentLlmClassifier } from "../modules/llm/intent-llm.classifier.js";
import { parseIntentClassificationFromText } from "../modules/llm/intent-llm.parser.js";
import type {
  Intent,
  IntentClassification,
} from "../modules/llm/intent.types.js";

function assertLabel(label: string, ok: boolean): boolean {
  console.log(`[verify:intent] ${ok ? "OK" : "FAIL"} — ${label}`);
  return ok;
}

type ParseCase = {
  label: string;
  raw: string;
  expect: IntentClassification | null;
};

const PARSE_CASES: ParseCase[] = [
  {
    label: "parse — JSON válido (greeting)",
    raw: JSON.stringify({
      intent: "greeting",
      needsRag: false,
      needsUserFacts: false,
      shouldExtractFacts: false,
      riskLevel: "low",
      reason: "Saudação simples.",
    }),
    expect: {
      intent: "greeting",
      needsRag: false,
      needsUserFacts: false,
      shouldExtractFacts: false,
      riskLevel: "low",
      reason: "Saudação simples.",
    },
  },
  {
    label: "parse — markdown fence",
    raw: '```json\n{"intent":"menu_inquiry","needsRag":true,"needsUserFacts":false,"shouldExtractFacts":false,"riskLevel":"low","reason":"Pergunta sobre cardápio."}\n```',
    expect: {
      intent: "menu_inquiry",
      needsRag: true,
      needsUserFacts: false,
      shouldExtractFacts: false,
      riskLevel: "low",
      reason: "Pergunta sobre cardápio.",
    },
  },
  {
    label: "parse — JSON inválido",
    raw: "not json",
    expect: null,
  },
  {
    label: "parse — intent inválido",
    raw: JSON.stringify({
      intent: "order_pizza",
      needsRag: true,
      needsUserFacts: false,
      shouldExtractFacts: false,
      riskLevel: "low",
      reason: "x",
    }),
    expect: null,
  },
  {
    label: "parse — reason vazio",
    raw: JSON.stringify({
      intent: "greeting",
      needsRag: false,
      needsUserFacts: false,
      shouldExtractFacts: false,
      riskLevel: "low",
      reason: "",
    }),
    expect: null,
  },
];

function matchesClassification(
  result: IntentClassification | null,
  expect: IntentClassification | null,
): boolean {
  if (result === null && expect === null) {
    return true;
  }
  if (result === null || expect === null) {
    return false;
  }

  return (
    result.intent === expect.intent &&
    result.needsRag === expect.needsRag &&
    result.needsUserFacts === expect.needsUserFacts &&
    result.shouldExtractFacts === expect.shouldExtractFacts &&
    result.riskLevel === expect.riskLevel
  );
}

async function main(): Promise<void> {
  let passed = 0;
  let total = 0;

  for (const testCase of PARSE_CASES) {
    total += 1;
    const result = parseIntentClassificationFromText(testCase.raw);
    if (
      assertLabel(
        testCase.label,
        matchesClassification(result, testCase.expect),
      )
    ) {
      passed += 1;
    } else {
      console.log("  expected:", testCase.expect);
      console.log("  got:", result);
    }
  }

  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.log(
      "\n[verify:intent] SKIP live OpenAI — OPENAI_API_KEY não definida",
    );
    console.log(`[verify:intent] ${passed}/${total} checks passed (parser only)`);
    if (passed !== total) {
      process.exitCode = 1;
    }
    return;
  }

  const llm = new IntentLlmClassifier();

  total += 1;
  const greeting = await llm.classify("Oi");
  if (
    assertLabel(
      "live — saudação",
      greeting !== null &&
        greeting.intent === "greeting" &&
        greeting.needsRag === false,
    )
  ) {
    passed += 1;
  } else {
    console.log("  got:", greeting);
  }

  total += 1;
  const menu = await llm.classify("Quais opções veganas vocês têm?");
  if (
    assertLabel(
      "live — cardápio",
      menu !== null && menu.needsRag === true && !menu.shouldExtractFacts,
    )
  ) {
    passed += 1;
  } else {
    console.log("  got:", menu);
  }

  total += 1;
  const recommend = await llm.classify("O que você me recomenda hoje?");
  if (
    assertLabel(
      "live — recomendação personalizada",
      recommend !== null &&
        recommend.needsRag === true &&
        recommend.needsUserFacts === true &&
        recommend.shouldExtractFacts === false,
    )
  ) {
    passed += 1;
  } else {
    console.log("  got:", recommend);
  }

  console.log(`\n[verify:intent] ${passed}/${total} checks passed`);

  if (passed !== total) {
    process.exitCode = 1;
  }
}

void main();
