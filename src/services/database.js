import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { config } from '../config/index.js'
import { migrate } from '../db/migrate.js'
import { log } from '../core/logger.js'
import { GROUP_SETTING_DEFAULTS } from '../config/constants.js'
import { toNumber, normalizeJid, isGroupJid } from '../lib/jid.js'

const logger = log('db')

let db = null

/** Open (or create) the database. Safe to call more than once. */
export function initDb() {
  if (db) return db
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true })
  db = new Database(config.dbPath)
  migrate(db)
  logger.info('database ready at %s', config.dbPath)
  return db
}

export function getDb() {
  if (!db) initDb()
  return db
}

export const closeDb = () => {
  try {
    db?.close()
  } catch {
    /* already closed */
  }
  db = null
}

const now = () => Date.now()

// ── users ─────────────────────────────────────
export const users = {
  touch(jid, name = null) {
    const id = normalizeJid(jid)
    if (!id) return
    getDb()
      .prepare(
        `INSERT INTO users (jid, number, name, last_seen, created_at)
         VALUES (@jid, @number, @name, @now, @now)
         ON CONFLICT(jid) DO UPDATE SET
           last_seen = @now,
           name = COALESCE(@name, users.name)`
      )
      .run({ jid: id, number: toNumber(id), name, now: now() })
  },

  bumpCommands(jid) {
    const id = normalizeJid(jid)
    getDb()
      .prepare(
        `INSERT INTO users (jid, number, command_count, last_seen, created_at)
         VALUES (@jid, @number, 1, @now, @now)
         ON CONFLICT(jid) DO UPDATE SET command_count = command_count + 1, last_seen = @now`
      )
      .run({ jid: id, number: toNumber(id), now: now() })
  },

  get(jid) {
    return getDb().prepare('SELECT * FROM users WHERE jid = ?').get(normalizeJid(jid)) ?? null
  },

  count() {
    return getDb().prepare('SELECT COUNT(*) AS c FROM users').get().c
  },

  topCommands(limit = 8) {
    return getDb().prepare('SELECT command, count FROM command_stats ORDER BY count DESC LIMIT ?').all(limit)
  }
}

// ── chats ─────────────────────────────────────
export const chats = {
  touch(jid, name = null) {
    const id = normalizeJid(jid)
    if (!id) return
    const type = isGroupJid(id) ? 'group' : 'private'
    getDb()
      .prepare(
        `INSERT INTO chats (jid, type, name, created_at, updated_at)
         VALUES (@jid, @type, @name, @now, @now)
         ON CONFLICT(jid) DO UPDATE SET updated_at = @now, name = COALESCE(@name, chats.name)`
      )
      .run({ jid: id, type, name, now: now() })
    if (type === 'group') {
      getDb()
        .prepare('INSERT OR IGNORE INTO group_settings (jid, updated_at) VALUES (?, ?)')
        .run(id, now())
    }
  },

  countGroups() {
    return getDb().prepare("SELECT COUNT(*) AS c FROM chats WHERE type = 'group'").get().c
  }
}

// ── group settings ────────────────────────────
export const groups = {
  settings(jid) {
    const id = normalizeJid(jid)
    const row = getDb().prepare('SELECT * FROM group_settings WHERE jid = ?').get(id)
    return { ...GROUP_SETTING_DEFAULTS, max_warns: config.maxWarns, jid: id, ...(row ?? {}) }
  },

  set(jid, key, value) {
    const id = normalizeJid(jid)
    // Guarantee the parent chat row exists (foreign key from group_settings).
    getDb()
      .prepare(
        `INSERT INTO chats (jid, type, created_at, updated_at) VALUES (@jid, 'group', @now, @now)
         ON CONFLICT(jid) DO NOTHING`
      )
      .run({ jid: id, now: now() })
    const allowed = ['antilink', 'antispam', 'antidelete', 'welcome', 'goodbye', 'mute', 'welcome_text', 'goodbye_text', 'max_warns']
    if (!allowed.includes(key)) throw new Error(`Unknown group setting "${key}"`)
    getDb()
      .prepare(
        `INSERT INTO group_settings (jid, ${key}, updated_at) VALUES (@jid, @value, @now)
         ON CONFLICT(jid) DO UPDATE SET ${key} = @value, updated_at = @now`
      )
      .run({ jid: id, value, now: now() })
    return this.settings(id)
  },

  all() {
    return getDb()
      .prepare(
        `SELECT c.jid, c.name, g.* FROM chats c
         LEFT JOIN group_settings g ON g.jid = c.jid
         WHERE c.type = 'group' ORDER BY c.name`
      )
      .all()
  }
}

// ── warnings ──────────────────────────────────
export const warns = {
  add(groupJid, userJid, reason = null, issuedBy = null) {
    getDb()
      .prepare('INSERT INTO warns (group_jid, user_jid, reason, issued_by, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(normalizeJid(groupJid), normalizeJid(userJid), reason, issuedBy ? normalizeJid(issuedBy) : null, now())
    return this.count(groupJid, userJid)
  },

  count(groupJid, userJid) {
    return (
      getDb()
        .prepare('SELECT COUNT(*) AS c FROM warns WHERE group_jid = ? AND user_jid = ?')
        .get(normalizeJid(groupJid), normalizeJid(userJid))?.c ?? 0
    )
  },

  list(groupJid, userJid) {
    return getDb()
      .prepare('SELECT * FROM warns WHERE group_jid = ? AND user_jid = ? ORDER BY id DESC')
      .all(normalizeJid(groupJid), normalizeJid(userJid))
  },

  reset(groupJid, userJid = null) {
    if (userJid) {
      return getDb()
        .prepare('DELETE FROM warns WHERE group_jid = ? AND user_jid = ?')
        .run(normalizeJid(groupJid), normalizeJid(userJid)).changes
    }
    return getDb().prepare('DELETE FROM warns WHERE group_jid = ?').run(normalizeJid(groupJid)).changes
  }
}

// ── members ───────────────────────────────────
export const members = {
  sync(groupJid, participants = []) {
    const gid = normalizeJid(groupJid)
    const stmt = getDb().prepare(
      `INSERT INTO members (group_jid, user_jid, is_admin, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(group_jid, user_jid) DO UPDATE SET is_admin = excluded.is_admin, updated_at = excluded.updated_at`
    )
    const tx = getDb().transaction((rows) => {
      for (const p of rows) {
        const jid = normalizeJid(p.id ?? p.phoneNumber ?? '')
        if (!jid) continue
        const admin = p.admin === 'admin' || p.admin === 'superadmin' ? 1 : 0
        stmt.run(gid, jid, admin, now())
      }
    })
    tx(participants)
  },

  list(groupJid) {
    return getDb().prepare('SELECT * FROM members WHERE group_jid = ?').all(normalizeJid(groupJid))
  }
}

// ── key/value settings ────────────────────────
export const settings = {
  get(key, fallback = null) {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key)
    if (!row) return fallback
    try {
      return JSON.parse(row.value)
    } catch {
      return row.value
    }
  },

  set(key, value) {
    getDb()
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (@key, @value, @now)
         ON CONFLICT(key) DO UPDATE SET value = @value, updated_at = @now`
      )
      .run({ key, value: JSON.stringify(value), now: now() })
    return value
  },

  toggle(key, fallback = false) {
    const next = !this.get(key, fallback)
    this.set(key, next)
    return next
  }
}

// ── stats ─────────────────────────────────────
export const stats = {
  bumpCommand(name) {
    getDb()
      .prepare(
        `INSERT INTO command_stats (command, count, last_used) VALUES (@name, 1, @now)
         ON CONFLICT(command) DO UPDATE SET count = count + 1, last_used = @now`
      )
      .run({ name, now: now() })
  },

  commands(limit = 10) {
    return getDb().prepare('SELECT command, count, last_used FROM command_stats ORDER BY count DESC LIMIT ?').all(limit)
  }
}

// ── anti-delete archive ───────────────────────
export const deleted = {
  save({ chatJid, senderJid, messageId, body, mediaType = null }) {
    getDb()
      .prepare(
        `INSERT INTO deleted_messages (chat_jid, sender_jid, message_id, body, media_type, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(normalizeJid(chatJid), senderJid ? normalizeJid(senderJid) : null, messageId, body, mediaType, now())
  },

  recent(chatJid, limit = 5) {
    return getDb()
      .prepare('SELECT * FROM deleted_messages WHERE chat_jid = ? ORDER BY id DESC LIMIT ?')
      .all(normalizeJid(chatJid), limit)
  }
}

// ── AI memory ─────────────────────────────────
export const aiMemory = {
  push(chatJid, role, content) {
    const db = getDb()
    db.prepare('INSERT INTO ai_memory (chat_jid, role, content, created_at) VALUES (?, ?, ?, ?)').run(
      normalizeJid(chatJid),
      role,
      content,
      now()
    )
    // keep the table from growing forever
    db.prepare(
      `DELETE FROM ai_memory WHERE chat_jid = ? AND id NOT IN (
         SELECT id FROM ai_memory WHERE chat_jid = ? ORDER BY id DESC LIMIT 40
       )`
    ).run(normalizeJid(chatJid), normalizeJid(chatJid))
  },

  history(chatJid, turns = 12) {
    const rows = getDb()
      .prepare('SELECT role, content FROM ai_memory WHERE chat_jid = ? ORDER BY id DESC LIMIT ?')
      .all(normalizeJid(chatJid), turns * 2)
    return rows.reverse()
  },

  clear(chatJid) {
    return getDb().prepare('DELETE FROM ai_memory WHERE chat_jid = ?').run(normalizeJid(chatJid)).changes
  }
}

// ── reminders ─────────────────────────────────
export const reminders = {
  add({ chatJid, userJid, message, dueAt }) {
    const info = getDb()
      .prepare(
        'INSERT INTO reminders (chat_jid, user_jid, message, due_at, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(normalizeJid(chatJid), userJid ? normalizeJid(userJid) : null, message, dueAt, now())
    return info.lastInsertRowid
  },

  due(before = now()) {
    return getDb().prepare('SELECT * FROM reminders WHERE delivered = 0 AND due_at <= ?').all(before)
  },

  markDelivered(id) {
    getDb().prepare('UPDATE reminders SET delivered = 1 WHERE id = ?').run(id)
  },

  pending(chatJid) {
    return getDb()
      .prepare('SELECT * FROM reminders WHERE chat_jid = ? AND delivered = 0 ORDER BY due_at')
      .all(normalizeJid(chatJid))
  }
}

/** Aggregate numbers for the panel and the .stats command. */
export function summary() {
  const db = getDb()
  return {
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    groups: db.prepare("SELECT COUNT(*) AS c FROM chats WHERE type = 'group'").get().c,
    warns: db.prepare('SELECT COUNT(*) AS c FROM warns').get().c,
    commands: db.prepare('SELECT COALESCE(SUM(count),0) AS c FROM command_stats').get().c,
    memoryRows: db.prepare('SELECT COUNT(*) AS c FROM ai_memory').get().c
  }
}

export default {
  initDb,
  getDb,
  closeDb,
  users,
  chats,
  groups,
  warns,
  members,
  settings,
  stats,
  deleted,
  aiMemory,
  reminders,
  summary
}
