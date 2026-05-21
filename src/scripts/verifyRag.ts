/**
 * Valida retrieval RAG (Issue #6) — requer `chroma run`, `seed:kb` e OPENAI_API_KEY.
 * Uso: npm run verify:rag
 */
import {
  RAG_MAX_DISTANCE,
  RAG_TOP_K,
  RAG_WEAK_RESULT_SLACK,
} from "../modules/rag/rag.config.js";
import {
  buildRagDebugSnapshot,
  formatRagDebugLines,
  searchKnowledgeBase,
} from "../modules/rag/rag.service.js";

const CONTENT_PREVIEW_LENGTH = 160;

type VerifyCase = {
  label: string;
  query: string;
  /** Se a busca deve retornar chunks após filtro de distância. */
  expectRag: boolean;
};

const VERIFY_CASES: VerifyCase[] = [
  {
    label: "menu — vegetarian options",
    query: "Quais opções vegetarianas vocês têm?",
    expectRag: true,
  },
  {
    label: "menu — vegan options",
    query: "Vocês têm opções veganas?",
    expectRag: true,
  },
  {
    label: "allergens — burgers without bacon",
    query: "Quais hambúrgueres não têm bacon?",
    expectRag: true,
  },
  {
    label: "allergens — lactose-free",
    query: "Vocês têm opções sem lactose?",
    expectRag: true,
  },
  {
    label: "recommendation — sides for spicy burger",
    query: "Quais acompanhamentos combinam com hambúrguer apimentado?",
    expectRag: true,
  },
  {
    label: "hours",
    query: "Que horas vocês abrem?",
    expectRag: true,
  },
  {
    label: "house sauces",
    query: "Quais molhos são da casa?",
    expectRag: true,
  },
  {
    label: "empty query",
    query: "   ",
    expectRag: false,
  },
];

function previewContent(content: string): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  if (oneLine.length <= CONTENT_PREVIEW_LENGTH) {
    return oneLine;
  }
  return `${oneLine.slice(0, CONTENT_PREVIEW_LENGTH)}…`;
}

async function runCase(testCase: VerifyCase): Promise<boolean> {
  console.log(`\n[verify:rag] ── ${testCase.label}`);
  console.log(`[verify:rag] Query: ${testCase.query.trim() || "(empty)"}`);

  const results = await searchKnowledgeBase(testCase.query);
  const snapshot = buildRagDebugSnapshot(testCase.query, results);

  for (const line of formatRagDebugLines(snapshot)) {
    console.log(`[verify:rag]   ${line}`);
  }

  for (const result of results) {
    console.log(
      `[verify:rag]   content: ${previewContent(result.content)}`,
    );
  }

  const ok = snapshot.usedRag === testCase.expectRag;
  console.log(
    `[verify:rag]   ${ok ? "PASS" : "FAIL"} (expected usedRag=${testCase.expectRag}, got ${snapshot.usedRag})`,
  );

  return ok;
}

async function main(): Promise<void> {
  console.log("[verify:rag] Burger Queen — RAG retrieval smoke tests");
  console.log(
    `[verify:rag] topK=${RAG_TOP_K}, maxDistance=${RAG_MAX_DISTANCE}, weakSlack=${RAG_WEAK_RESULT_SLACK}\n`,
  );

  let passed = 0;

  for (const testCase of VERIFY_CASES) {
    const ok = await runCase(testCase);
    if (ok) {
      passed += 1;
    }
  }

  console.log(`\n[verify:rag] Resumo: ${passed}/${VERIFY_CASES.length} casos OK`);

  if (passed < VERIFY_CASES.length) {
    console.error(
      "[verify:rag] Alguns casos falharam. Confira: chroma run, npm run seed:kb, OPENAI_API_KEY, RAG_MAX_DISTANCE.",
    );
    process.exit(1);
  }

  console.log("[verify:rag] Concluído com sucesso.");
}

main().catch((error: unknown) => {
  console.error("\n[verify:rag] Erro ao executar testes.");

  if (error instanceof Error) {
    console.error(`[verify:rag] ${error.message}`);
  } else {
    console.error(error);
  }

  console.error(
    "\n[verify:rag] Verifique: chroma run, npm run seed:kb, OPENAI_API_KEY no .env.",
  );
  process.exit(1);
});
