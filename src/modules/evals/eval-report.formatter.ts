import type { EvalCaseResult } from "./eval-runner.service.js";

export type BaselineReportInput = {
  generatedAt: string;
  environment: Record<string, string>;
  casesFile: string;
  results: EvalCaseResult[];
};

function statusLabel(status: EvalCaseResult["status"]): string {
  return status.toUpperCase();
}

function summarizeNotes(result: EvalCaseResult): string {
  if (result.errorMessage) {
    return result.errorMessage;
  }
  if (result.failures.length > 0) {
    return result.failures[0] ?? "failed";
  }
  const intent = result.evidence.intent;
  if (typeof intent === "string") {
    return `intent=${intent}`;
  }
  if (result.kind === "isolation_db") {
    return `facts ${String(result.evidence.factsACount)}/${String(result.evidence.factsBCount)}`;
  }
  return "ok";
}

function formatEvidenceBlock(result: EvalCaseResult): string {
  const lines: string[] = [
    `**Status:** ${statusLabel(result.status)}`,
    `**Kind:** ${result.kind}`,
  ];

  if (result.errorMessage) {
    lines.push(`**Error:** ${result.errorMessage}`);
  }

  if (result.failures.length > 0) {
    lines.push("", "**Failures:**");
    for (const failure of result.failures) {
      lines.push(`- ${failure}`);
    }
  }

  lines.push("", "**Evidence:**", "```json");
  lines.push(JSON.stringify(result.evidence, null, 2));
  lines.push("```");

  return lines.join("\n");
}

export function formatBaselineResultsMarkdown(
  input: BaselineReportInput,
): string {
  const passCount = input.results.filter((r) => r.status === "pass").length;
  const failCount = input.results.filter((r) => r.status === "fail").length;
  const errorCount = input.results.filter((r) => r.status === "error").length;

  const lines: string[] = [
    "# Burger Queen — Eval baseline",
    "",
    `Generated: ${input.generatedAt}`,
    "",
    "## Environment",
    "",
  ];

  for (const [key, value] of Object.entries(input.environment)) {
    lines.push(`- ${key}: ${value}`);
  }

  lines.push(
    "",
    `Cases file: \`${input.casesFile}\``,
    "",
    "## Summary",
    "",
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Total | ${input.results.length} |`,
    `| PASS | ${passCount} |`,
    `| FAIL | ${failCount} |`,
    `| ERROR | ${errorCount} |`,
    "",
    "## Results",
    "",
    "| Case | Status | Notes |",
    "|------|--------|-------|",
  );

  for (const result of input.results) {
    const notes = summarizeNotes(result).replace(/\|/g, "\\|");
    lines.push(
      `| ${result.caseId} | ${statusLabel(result.status)} | ${notes} |`,
    );
  }

  lines.push("", "## Details", "");

  for (const result of input.results) {
    lines.push(`### ${result.caseId}`, "", result.description, "");
    lines.push(formatEvidenceBlock(result), "");
  }

  return lines.join("\n");
}
