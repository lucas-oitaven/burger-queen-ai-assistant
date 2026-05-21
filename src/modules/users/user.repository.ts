import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { formatDisplayName, normalizeLoginName } from "../../utils/text.js";
import type { User } from "./user.types.js";

type UserRow = {
  id: string;
  login_name: string;
  name: string;
  created_at: string;
};

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    loginName: row.login_name,
    name: row.name,
    createdAt: row.created_at,
  };
}

export class UserRepository {
  constructor(private readonly db: Database.Database) {}

  findById(id: string): User | null {
    const row = this.db
      .prepare(
        `SELECT id, login_name, name, created_at FROM users WHERE id = ?`,
      )
      .get(id) as UserRow | undefined;

    return row ? mapUser(row) : null;
  }

  findByLoginName(loginName: string): User | null {
    const row = this.db
      .prepare(
        `SELECT id, login_name, name, created_at FROM users WHERE login_name = ?`,
      )
      .get(loginName) as UserRow | undefined;

    return row ? mapUser(row) : null;
  }

  create(loginName: string, displayName: string): User {
    const id = randomUUID();
    this.db
      .prepare(`INSERT INTO users (id, login_name, name) VALUES (?, ?, ?)`)
      .run(id, loginName, displayName);

    const user = this.findById(id);
    if (!user) {
      throw new Error(`Failed to create user: ${loginName}`);
    }
    return user;
  }

  /**
   * Cria no banco ou retorna o usuário existente (ex.: /login ana).
   */
  findOrCreateByLoginName(rawLoginName: string): User {
    const loginName = normalizeLoginName(rawLoginName);
    if (!loginName) {
      throw new Error("Login name cannot be empty");
    }

    const existing = this.findByLoginName(loginName);
    if (existing) {
      return existing;
    }

    return this.create(loginName, formatDisplayName(rawLoginName));
  }
}
