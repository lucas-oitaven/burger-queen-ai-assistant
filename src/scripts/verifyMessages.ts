/**
 * Lista mensagens por usuário — útil após Parte 3.3.
 * Uso: npx tsx src/scripts/verifyMessages.ts
 */
import { closeDatabase, getDatabase } from "../database/sqlite.js";

function main(): void {
  const db = getDatabase();

  const users = db
    .prepare(`SELECT id, login_name, name FROM users ORDER BY name`)
    .all() as { id: string; login_name: string; name: string }[];

  if (users.length === 0) {
    console.log("[verify:messages] Nenhum usuário — faça /login no chat primeiro.");
    closeDatabase();
    return;
  }

  for (const user of users) {
    const messages = db
      .prepare(
        `SELECT role, content FROM messages
         WHERE user_id = ?
         ORDER BY created_at ASC, id ASC`,
      )
      .all(user.id) as { role: string; content: string }[];

    console.log(
      `\n[${user.name} / login=${user.login_name}] (${messages.length} mensagens)`,
    );
    for (const m of messages) {
      console.log(`  ${m.role}: ${m.content}`);
    }
  }

  closeDatabase();
}

main();
