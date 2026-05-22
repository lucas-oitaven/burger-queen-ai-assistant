/**
 * Smoke test Issue #9 Parte 9.1 — orchestration_logs + memória curta.
 * Uso: npm run verify:orchestration-base
 */
import { closeDatabase, getDatabase } from "../database/sqlite.js";
import { SHORT_TERM_MESSAGE_LIMIT } from "../modules/chat/chat.config.js";
import { MessageRepository } from "../modules/chat/message.repository.js";
import { OrchestrationLogRepository } from "../modules/chat/orchestration-log.repository.js";
import { UserRepository } from "../modules/users/user.repository.js";

function main(): void {
  const db = getDatabase();

  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'orchestration_logs'`,
    )
    .get() as { name: string } | undefined;

  if (!tables) {
    console.error("[verify:orchestration-base] FAIL — tabela orchestration_logs ausente");
    process.exitCode = 1;
    return;
  }

  const users = new UserRepository(db);
  const messages = new MessageRepository(db);
  const logs = new OrchestrationLogRepository(db);

  const suffix = Date.now().toString(36);
  const user = users.findOrCreateByLoginName(`verify_orch_base_${suffix}`);

  const userMsg = messages.create(user.id, "user", "Quero opções veganas");
  messages.create(user.id, "assistant", "Temos burgers vegetarianos");
  messages.create(user.id, "user", "Obrigado");

  const recent = messages.findRecentByUserId(
    user.id,
    SHORT_TERM_MESSAGE_LIMIT,
  );

  const log = logs.create({
    userId: user.id,
    messageId: userMsg.id,
    intent: "menu_inquiry",
    needsRag: true,
    needsUserFacts: false,
    shouldExtractFacts: false,
    retrievedDocs: ["04-opcoes-vegetarianas.md"],
    savedFacts: [],
    riskLevel: "low",
  });

  const recentOk =
    recent.length === 3 &&
    recent[0]?.role === "user" &&
    recent[2]?.content === "Obrigado";
  const logOk =
    log.intent === "menu_inquiry" &&
    log.retrievedDocs[0] === "04-opcoes-vegetarianas.md";

  console.log("[verify:orchestration-base] user:", user.name);
  console.log("[verify:orchestration-base] recent messages:", recent.length);
  console.log("[verify:orchestration-base] log id:", log.id, "intent:", log.intent);
  console.log(
    `[verify:orchestration-base] ${recentOk && logOk ? "OK" : "FAIL"} — memória curta + log`,
  );

  closeDatabase();

  if (!recentOk || !logOk) {
    process.exitCode = 1;
  }
}

main();
