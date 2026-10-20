import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { log } from '../core/logger.js'

const logger = log('db')
const SCHEMA_VERSION = 2

/**
 * Applies db/schema.sql. The schema is written with IF NOT EXISTS and
 * additive-only changes, so it is safe to run on every boot.
 */
export function migrate(db) {
  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(sql)

  const current = db.prepare('SELECT MAX(version) AS v FROM schema_version').get()?.v ?? 0
  if (current < SCHEMA_VERSION) {
    db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(SCHEMA_VERSION, Date.now())
    logger.info('schema migrated to v%s', SCHEMA_VERSION)
  }

  return { from: current, to: SCHEMA_VERSION }
}
