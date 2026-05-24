import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { INTENTS, RISK_LEVELS } from "../llm/intent.types.js";
import { ORCHESTRATION_TOOL_NAMES } from "../chat/orchestration.tools.js";

export const EVAL_CASE_KINDS = [
  "orchestration",
  "isolation_db",
  "live_memory",
] as const;

export type EvalCaseKind = (typeof EVAL_CASE_KINDS)[number];

/** Expectativas estruturais — campos usados conforme `kind` do caso. */
export const evalExpectationSchema = z.object({
  intent: z.enum(INTENTS).optional(),
  needsRag: z.boolean().optional(),
  ragUsed: z.boolean().optional(),
  usedLongTermMemory: z.boolean().optional(),
  retrievedDocIncludes: z.array(z.string().min(1)).optional(),
  savedFactsCountMax: z.number().int().min(0).optional(),
  savedFactsCountMin: z.number().int().min(0).optional(),
  needsUserFacts: z.boolean().optional(),
  usedShortTermMemory: z.boolean().optional(),
  persistKeyword: z.string().min(1).optional(),
  toolsMustInclude: z
    .array(
      z.object({
        tool: z.enum(ORCHESTRATION_TOOL_NAMES),
        invoked: z.boolean(),
      }),
    )
    .optional(),
  riskLevel: z.enum(RISK_LEVELS).optional(),
  replyIncludes: z.array(z.string().min(1)).optional(),
  compareLogins: z.tuple([z.string().min(1), z.string().min(1)]).optional(),
  loginAFactKeywords: z.array(z.string().min(1)).optional(),
  loginBFactKeywords: z.array(z.string().min(1)).optional(),
  noSharedNormalizedFacts: z.boolean().optional(),
});

export type EvalExpectation = z.infer<typeof evalExpectationSchema>;

export const evalCaseSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(EVAL_CASE_KINDS),
  loginName: z.string().min(1).optional(),
  message: z.string().optional(),
  extractMessage: z.string().min(1).optional(),
  followUpMessage: z.string().optional(),
  expect: evalExpectationSchema,
  followUpExpect: evalExpectationSchema.optional(),
});

export type EvalCase = z.infer<typeof evalCaseSchema>;

export const evalCasesFileSchema = z.object({
  version: z.literal(1),
  cases: z.array(evalCaseSchema).min(1),
});

export type EvalCasesFile = z.infer<typeof evalCasesFileSchema>;

/** Caminho padrão a partir da raiz do projeto. */
export const DEFAULT_EVAL_CASES_PATH = join(
  process.cwd(),
  "evals",
  "eval-cases.json",
);

export function parseEvalCasesFile(data: unknown): EvalCasesFile | null {
  const parsed = evalCasesFileSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function loadEvalCases(
  filePath: string = DEFAULT_EVAL_CASES_PATH,
): EvalCasesFile {
  const raw = readFileSync(filePath, "utf-8");
  const json: unknown = JSON.parse(raw);
  const parsed = parseEvalCasesFile(json);

  if (!parsed) {
    throw new Error(`Invalid eval cases file: ${filePath}`);
  }

  return parsed;
}
