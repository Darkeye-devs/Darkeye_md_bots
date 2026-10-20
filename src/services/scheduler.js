import cron from 'node-cron'
import fs from 'node:fs'
import path from 'node:path'
import { config } from '../config/index.js'
import { db } from './index.js'
import { log } from '../core/logger.js'
import { paths } from '../config/index.js'
import { formatDuration } from '../lib/time.js'

const logger = log('scheduler')
const jobs = []

/**
 * Background jobs. Every job is real work — no placeholder cron entries.
 */

/** Deliver due reminders every 20 seconds. */
async function deliverReminders(sock) {
  if (!sock) return
  const due = db.reminders.due()
  for (const reminder of due) {
    try {
      const mention = reminder.user_jid ? `@${reminder.user_jid.split('@')[0]} ` : ''
      await sock.sendMessage(reminder.chat_jid, {
        text: `⏰ ${mention}Reminder: *${reminder.message}*`,
        mentions: reminder.user_jid ? [reminder.user_jid] : []
      })
      db.reminders.markDelivered(reminder.id)
    } catch (error) {
      logger.warn('reminder %d failed: %s', reminder.id, error.message)
      db.reminders.markDelivered(reminder.id)
    }
  }
}

/** Copy the SQLite file into backups/ — a real, restorable backup. */
function backupDatabase() {
  try {
    fs.mkdirSync(config.backupDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const target = path.join(config.backupDir, `darkeyes-${stamp}.db`)
    fs.copyFileSync(config.dbPath, target)
    logger.info('database backed up to %s', path.basename(target))

    // keep the last 7
    const files = fs.readdirSync(config.backupDir).filter((f) => f.endsWith('.db')).sort()
    for (const old of files.slice(0, Math.max(0, files.length - 7))) {
      fs.unlinkSync(path.join(config.backupDir, old))
    }
  } catch (error) {
    logger.error('backup failed: %s', error.message)
  }
}

/** Delete temp files older than an hour. */
function cleanTmp() {
  try {
    const now = Date.now()
    for (const file of fs.readdirSync(paths.tmp)) {
      const full = path.join(paths.tmp, file)
      const stat = fs.statSync(full)
      if (now - stat.mtimeMs > 60 * 60 * 1000) fs.unlinkSync(full)
    }
  } catch {
    /* tmp folder may not exist yet */
  }
}

export function start(sock) {
  jobs.push(
    cron.schedule('*/20 * * * * *', () => deliverReminders(sock), { timezone: config.timezone }),
    cron.schedule('0 3 * * *', backupDatabase, { timezone: config.timezone }),
    cron.schedule('0 * * * *', cleanTmp)
  )
  logger.info('scheduler running %d jobs (tz %s)', jobs.length, config.timezone)
}

export function stop() {
  for (const job of jobs) job.stop()
  jobs.length = 0
}

/** Exposed so .remind can show what is pending. */
export function pendingFor(chatJid) {
  return db.reminders.pending(chatJid).map((r) => ({
    ...r,
    in: formatDuration(r.due_at - Date.now())
  }))
}

export { backupDatabase }
export default { start, stop, pendingFor, backupDatabase }
