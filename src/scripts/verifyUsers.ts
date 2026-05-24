/**
 * Lista usuários no SQLite — útil após /login na Parte 3.2.
 * Uso: npx tsx src/scripts/verifyUsers.ts
 */
import { closeDatabase, getDatabase } from "../database/sqlite.js";

function main(): void {
  const db = getDatabase();

  const users = db
    .prepare(
      `SELECT id, login_name, name, created_at FROM users ORDER BY created_at`,
    )
    .all() as {
      id: string;
      login_name: string;
      name: string;
      created_at: string;
    }[];

  if (users.length === 0) {
    console.log("[verify:users] Nenhum usuário no banco.");
  } else {
    console.log("[verify:users] Usuários:");
    for (const u of users) {
      console.log(
        `  - ${u.login_name} (${u.name}) id=${u.id} @ ${u.created_at}`,
      );
    }
  }

  closeDatabase();
}

main();
