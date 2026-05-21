import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";

const MIGRATIONS_DIR = join(__dirname);
const CURRENT_VERSION = 2;

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function getAppliedVersion(db: Database.Database): number {
  const row = db
    .prepare("SELECT MAX(version) AS version FROM schema_migrations")
    .get() as { version: number | null };

  return row.version ?? 0;
}

function recordMigration(db: Database.Database, version: number): void {
  db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(version);
}

function usersHaveLoginName(db: Database.Database): boolean {
  const columns = db.prepare("PRAGMA table_info(users)").all() as {
    name: string;
  }[];

  return columns.some((column) => column.name === "login_name");
}

/**
 * Bancos da Parte 3.1–3.3 usavam `users.id` = login normalizado.
 * Passa `id` para UUID e move o login para `login_name`.
 */
function migrateUsersToUuid(db: Database.Database): void {
  if (usersHaveLoginName(db)) {
    return;
  }

  db.pragma("foreign_keys = OFF");

  try {
    const migrate = db.transaction(() => {
      db.exec(`
        CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          login_name TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);

      const users = db
        .prepare(`SELECT id, name, created_at FROM users`)
        .all() as { id: string; name: string; created_at: string }[];

      const insertUser = db.prepare(
        `INSERT INTO users_new (id, login_name, name, created_at) VALUES (?, ?, ?, ?)`,
      );
      const updateMessages = db.prepare(
        `UPDATE messages SET user_id = ? WHERE user_id = ?`,
      );

      for (const user of users) {
        const newId = randomUUID();
        insertUser.run(newId, user.id, user.name, user.created_at);
        updateMessages.run(newId, user.id);
      }

      db.exec(`DROP TABLE users`);
      db.exec(`ALTER TABLE users_new RENAME TO users`);
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_users_login_name ON users(login_name)`,
      );
    });

    migrate();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

export function runMigrations(db: Database.Database): void {
  ensureMigrationsTable(db);

  let version = getAppliedVersion(db);
  if (version >= CURRENT_VERSION) {
    return;
  }

  if (version < 1) {
    const schemaSql = readFileSync(join(MIGRATIONS_DIR, "schema.sql"), "utf-8");
    db.exec(schemaSql);
    recordMigration(db, 1);
    version = 1;
  }

  if (version < 2) {
    migrateUsersToUuid(db);
    recordMigration(db, 2);
  }
}
