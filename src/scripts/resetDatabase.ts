/**
 * Remove e recria o banco SQLite local conforme DATABASE_PATH.
 * Issue — reset:db (útil antes de seed:demo com personas canônicas).
 */
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "../config/env.js";
import { closeDatabase, getDatabase } from "../database/sqlite.js";
import { isScriptMain } from "../utils/is-script-main.js";

function unlinkIfExists(path: string): void {
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

/** Fecha conexão, apaga arquivo(s) SQLite e reaplica schema + migrations. */
export function resetDatabase(): void {
  closeDatabase();

  const dbPath = env.DATABASE_PATH;
  unlinkIfExists(dbPath);
  unlinkIfExists(`${dbPath}-wal`);
  unlinkIfExists(`${dbPath}-shm`);

  mkdirSync(dirname(dbPath), { recursive: true });
  getDatabase();
}

async function main(): Promise<void> {
  console.log("[reset:db] Burger Queen — recriar banco SQLite");
  console.log(`[reset:db] Caminho: ${env.DATABASE_PATH}\n`);

  resetDatabase();

  console.log("[reset:db] Banco recriado (schema + migrations).");
  console.log("[reset:db] Próximo passo sugerido: npm run seed:demo");
  console.log("[reset:db] Concluído com sucesso.");
}

if (isScriptMain("resetDatabase.ts")) {
  main()
    .catch((error: unknown) => {
      console.error("\n[reset:db] Falha ao resetar o banco.");

      if (error instanceof Error) {
        console.error(`[reset:db] ${error.message}`);
      } else {
        console.error(error);
      }

      process.exit(1);
    })
    .finally(() => {
      closeDatabase();
    });
}
