import Database from "better-sqlite3";
import { runMigrations } from "../../src/database/migrations.js";

let testDatabase: Database.Database | null = null;

function openInMemoryDatabase(): Database.Database {
  try {
    return new Database(":memory:");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("NODE_MODULE_VERSION")) {
      throw new Error(
        `better-sqlite3 was built for a different Node.js than ${process.version}. ` +
          "Rebuild the native module for this Node version:\n\n" +
          "  npm run rebuild:native\n\n" +
          "Or reinstall dependencies (postinstall runs the same rebuild):\n\n" +
          "  npm install",
        { cause: error },
      );
    }
    throw error;
  }
}

/**
 * SQLite em memória com o mesmo schema de produção (`runMigrations`).
 * Usar em `beforeEach`; fechar com `closeTestDatabase` em `afterEach`.
 */
export function createTestDatabase(): Database.Database {
  if (testDatabase) {
    testDatabase.close();
  }

  testDatabase = openInMemoryDatabase();
  testDatabase.pragma("foreign_keys = ON");
  runMigrations(testDatabase);
  return testDatabase;
}

export function getTestDatabase(): Database.Database {
  if (!testDatabase) {
    return createTestDatabase();
  }
  return testDatabase;
}

export function closeTestDatabase(): void {
  if (testDatabase) {
    testDatabase.close();
    testDatabase = null;
  }
}
