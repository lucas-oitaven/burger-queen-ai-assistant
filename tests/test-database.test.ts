import { afterEach, describe, expect, it } from "vitest";
import {
  closeTestDatabase,
  createTestDatabase,
} from "./helpers/test-database.js";

describe("createTestDatabase", () => {
  afterEach(() => {
    closeTestDatabase();
  });

  it("applies migrations with core tables", () => {
    const db = createTestDatabase();

    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
      )
      .all() as { name: string }[];

    const names = tables.map((row) => row.name);

    expect(names).toContain("users");
    expect(names).toContain("messages");
    expect(names).toContain("user_facts");
    expect(names).toContain("schema_migrations");
  });

  it("supports inserting a user with UUID id", () => {
    const db = createTestDatabase();

    db.prepare(
      `INSERT INTO users (id, login_name, name, created_at) VALUES (?, ?, ?, datetime('now'))`,
    ).run("550e8400-e29b-41d4-a716-446655440000", "test_user", "Test User");

    const user = db
      .prepare(`SELECT login_name FROM users WHERE id = ?`)
      .get("550e8400-e29b-41d4-a716-446655440000") as {
      login_name: string;
    };

    expect(user.login_name).toBe("test_user");
  });
});
