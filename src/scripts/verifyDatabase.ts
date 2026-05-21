/**
 * Script auxiliar da Parte 3.1 — confirma conexão e tabelas.
 * Uso: npx tsx src/scripts/verifyDatabase.ts
 */
import { getDatabase, closeDatabase } from "../database/sqlite.js";

function main(): void {
  const db = getDatabase();

  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    )
    .all() as { name: string }[];

  console.log("[verify:db] Conexão OK.");
  console.log("[verify:db] Tabelas:", tables.map((t) => t.name).join(", "));

  closeDatabase();
}

main();
