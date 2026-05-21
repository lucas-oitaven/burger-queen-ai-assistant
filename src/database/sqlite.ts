import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { env } from "../config/env.js";
import { runMigrations } from "./migrations.js";

let database: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!database) {
    const dbPath = env.DATABASE_PATH;
    mkdirSync(dirname(dbPath), { recursive: true });
    database = new Database(dbPath);
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");
    runMigrations(database);
  }
  return database;
}

export function closeDatabase(): void {
  if (database) {
    database.close();
    database = null;
  }
}
