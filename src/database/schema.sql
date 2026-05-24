CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  login_name TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_login_name ON users(login_name);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at);

CREATE TABLE IF NOT EXISTS user_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  fact TEXT NOT NULL,
  normalized_fact TEXT,
  category TEXT,
  confidence REAL NOT NULL DEFAULT 1.0,
  source_message TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_facts_user_status ON user_facts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_facts_user_normalized ON user_facts(user_id, normalized_fact);

CREATE TABLE IF NOT EXISTS orchestration_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  session_id TEXT,
  message_id INTEGER,
  intent TEXT NOT NULL,
  needs_rag INTEGER NOT NULL DEFAULT 0,
  needs_user_facts INTEGER NOT NULL DEFAULT 0,
  should_extract_facts INTEGER NOT NULL DEFAULT 0,
  retrieved_docs TEXT,
  saved_facts TEXT,
  risk_level TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_orchestration_logs_user_created ON orchestration_logs(user_id, created_at);

CREATE TABLE IF NOT EXISTS conversation_state (
  user_id TEXT PRIMARY KEY,
  stage TEXT NOT NULL DEFAULT 'greeting',
  draft_order_json TEXT NOT NULL DEFAULT '[]',
  last_suggested_items_json TEXT NOT NULL DEFAULT '[]',
  completed_orders_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
