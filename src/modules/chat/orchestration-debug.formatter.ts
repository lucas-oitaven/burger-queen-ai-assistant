import { basename } from "node:path";
import type { IntentClassification } from "../llm/intent.types.js";
import type { UserFact } from "../memory/memory.types.js";
import type { ChatContext } from "./chat.types.js";
import type { OrchestrationDebugSnapshot } from "./orchestration-debug.types.js";

/**
 * Referência legível de um doc da KB (nome do arquivo, sem caminho absoluto).
 */
export function normalizeRetrievedDocRef(
  source: string,
  sourcePath?: string,
): string {
  const fromSource = basename(source.replace(/\\/g, "/")).trim();
  if (fromSource && fromSource !== "unknown") {
    return fromSource;
  }

  if (sourcePath) {
    return basename(sourcePath.replace(/\\/g, "/"));
  }

  return fromSource || "unknown";
}

export type BuildOrchestrationDebugInput = {
  userLogin: string;
  classification: IntentClassification;
  context: ChatContext;
  retrievedDocs: string[];
  savedFacts: UserFact[];
};

export function buildOrchestrationDebugSnapshot(
  input: BuildOrchestrationDebugInput,
): OrchestrationDebugSnapshot {
  const shortTermMessageCount = input.context.recentMessages.length;

  return {
    userLogin: input.userLogin,
    intent: input.classification.intent,
    usedShortTermMemory: shortTermMessageCount > 0,
    shortTermMessageCount,
    usedLongTermMemory: input.context.userFacts.length > 0,
    usedRag: input.retrievedDocs.length > 0,
    retrievedDocs: input.retrievedDocs.map((doc) =>
      normalizeRetrievedDocRef(doc),
    ),
    savedFacts: input.savedFacts.map((fact) => fact.fact),
    riskLevel: input.classification.riskLevel,
  };
}

/**
 * Linhas legíveis no estilo do projeto (`.ai-context` / demo Issue #10).
 */
export function formatOrchestrationDebugLines(
  snapshot: OrchestrationDebugSnapshot,
): string[] {
  const lines: string[] = [
    "[DEBUG]",
    `User: ${snapshot.userLogin}`,
    `Intent: ${snapshot.intent}`,
    `Used short-term memory: ${snapshot.usedShortTermMemory}`,
    `Used long-term memory: ${snapshot.usedLongTermMemory}`,
    `Used RAG: ${snapshot.usedRag}`,
  ];

  if (snapshot.retrievedDocs.length > 0) {
    lines.push("Retrieved docs:");
    for (const doc of snapshot.retrievedDocs) {
      lines.push(`- ${normalizeRetrievedDocRef(doc)}`);
    }
  }

  if (snapshot.savedFacts.length > 0) {
    lines.push("Saved facts:");
    for (const fact of snapshot.savedFacts) {
      lines.push(`- ${fact}`);
    }
  }

  lines.push(`Risk level: ${snapshot.riskLevel}`);

  return lines;
}
