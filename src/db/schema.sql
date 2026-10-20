-- ───────────────────────────────────────────────
--  Dark Eyes — SQLite schema
--  Migrations are additive; schema_version tracks progress.
-- ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS schema_version (
  version     INTEGER PRIMARY KEY,
  applied_at  INTEGER NOT NULL
);

-- Every chat the bot has seen
CREATE TABLE IF NOT EXISTS chats (
  jid          TEXT PRIMARY KEY,
  type         TEXT NOT NULL DEFAULT 'group',  -- group | private
  name         TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- Per-group behaviour toggles
CREATE TABLE IF NOT EXISTS group_settings (
  jid            TEXT PRIMARY KEY REFERENCES chats(jid) ON DELETE CASCADE,
  antilink       TEXT NOT NULL DEFAULT 'off',   -- off | warn | delete | kick
  antispam       INTEGER NOT NULL DEFAULT 0,
  antidelete     INTEGER NOT NULL DEFAULT 0,
  welcome        INTEGER NOT NULL DEFAULT 1,
  goodbye        INTEGER NOT NULL DEFAULT 1,
  mute           INTEGER NOT NULL DEFAULT 0,
  welcome_text   TEXT,
  goodbye_text   TEXT,
  max_warns      INTEGER NOT NULL DEFAULT 3,
  updated_at     INTEGER NOT NULL
);

-- Known users
CREATE TABLE IF NOT EXISTS users (
  jid            TEXT PRIMARY KEY,
  number         TEXT,
  name           TEXT,
  command_count  INTEGER NOT NULL DEFAULT 0,
  last_seen      INTEGER,
  created_at     INTEGER NOT NULL
);

-- Warnings issued inside groups
CREATE TABLE IF NOT EXISTS warns (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  group_jid   TEXT NOT NULL,
  user_jid    TEXT NOT NULL,
  reason      TEXT,
  issued_by   TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_warns_group_user ON warns(group_jid, user_jid);

-- Group member roster cache (handy for tagging "everyone")
CREATE TABLE IF NOT EXISTS members (
  group_jid   TEXT NOT NULL,
  user_jid    TEXT NOT NULL,
  is_admin    INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (group_jid, user_jid)
);

-- Flat persistent key/value store (bot mode, feature flags, etc.)
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Usage analytics for the panel
CREATE TABLE IF NOT EXISTS command_stats (
  command     TEXT PRIMARY KEY,
  count       INTEGER NOT NULL DEFAULT 0,
  last_used   INTEGER
);

-- Anti-delete archive of deleted messages
CREATE TABLE IF NOT EXISTS deleted_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_jid    TEXT NOT NULL,
  sender_jid  TEXT,
  message_id  TEXT,
  body        TEXT,
  media_type  TEXT,
  deleted_at  INTEGER NOT NULL
);

-- AI conversation memory, per chat
CREATE TABLE IF NOT EXISTS ai_memory (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_jid    TEXT NOT NULL,
  role        TEXT NOT NULL,       -- user | assistant | system
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_memory_chat ON ai_memory(chat_jid, id DESC);

-- Scheduled reminders
CREATE TABLE IF NOT EXISTS reminders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_jid    TEXT NOT NULL,
  user_jid    TEXT,
  message     TEXT NOT NULL,
  due_at      INTEGER NOT NULL,
  delivered   INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- ── added in schema v2 ──────────────────────────

-- Economy wallets (one row per user per chat keeps it local and fair)
CREATE TABLE IF NOT EXISTS economy (
  chat_jid     TEXT NOT NULL,
  user_jid     TEXT NOT NULL,
  balance      INTEGER NOT NULL DEFAULT 0,
  bank         INTEGER NOT NULL DEFAULT 0,
  last_daily   INTEGER NOT NULL DEFAULT 0,
  last_work    INTEGER NOT NULL DEFAULT 0,
  last_fish    INTEGER NOT NULL DEFAULT 0,
  last_mine    INTEGER NOT NULL DEFAULT 0,
  last_rob     INTEGER NOT NULL DEFAULT 0,
  job          TEXT,
  xp           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chat_jid, user_jid)
);

-- Purchased items
CREATE TABLE IF NOT EXISTS inventory (
  chat_jid   TEXT NOT NULL,
  user_jid   TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (chat_jid, user_jid, item_id)
);

-- Away-from-keyboard flags
CREATE TABLE IF NOT EXISTS afk (
  chat_jid   TEXT NOT NULL,
  user_jid   TEXT NOT NULL,
  reason     TEXT,
  since      INTEGER NOT NULL,
  PRIMARY KEY (chat_jid, user_jid)
);

-- Personal notes
CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_jid   TEXT NOT NULL,
  user_jid   TEXT NOT NULL,
  title      TEXT,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_chat_user ON notes(chat_jid, user_jid);

-- To-do items
CREATE TABLE IF NOT EXISTS todos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_jid   TEXT NOT NULL,
  user_jid   TEXT NOT NULL,
  body       TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
