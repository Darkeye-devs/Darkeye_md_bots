import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT_DIR = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

const str = (value, fallback = '') => {
  const v = (value ?? '').toString().trim()
  return v.length ? v : fallback
}

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on', 'y'].includes(value.toString().trim().toLowerCase())
}

const int = (value, fallback) => {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

/** International phone numbers, digits only, no plus sign. */
const phoneList = (value) =>
  (value ?? '')
    .split(',')
    .map((n) => n.replace(/[^0-9]/g, ''))
    .filter((n) => n.length >= 8)

const resolve = (p) => (path.isAbsolute(p) ? p : path.join(ROOT_DIR, p))

export const config = {
  rootDir: ROOT_DIR,
  botName: str(process.env.BOT_NAME, 'Dark Eyes'),
  botOwner: str(process.env.BOT_OWNER, 'Owner'),
  owners: phoneList(process.env.OWNER_NUMBER),
  prefix: str(process.env.PREFIX, '.'),
  mode: str(process.env.BOT_MODE, 'public').toLowerCase(),
  autoRead: bool(process.env.AUTO_READ),
  autoTyping: bool(process.env.AUTO_TYPING),
  maxWarns: int(process.env.MAX_WARNS, 3),
  timezone: str(process.env.TZ, 'Africa/Lagos'),

  port: int(process.env.PORT, 3000),
  panelToken: str(process.env.PANEL_TOKEN, ''),
  // Which origins may call the API from a browser (the Vercel landing page).
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((o) => o.trim()).filter(Boolean),

  sessionDir: resolve(str(process.env.SESSION_DIR, 'data/auth')),
  dbPath: resolve(str(process.env.DB_PATH, 'data/darkeyes.db')),
  backupDir: resolve('backups'),
  logLevel: str(process.env.LOG_LEVEL, 'info'),
  // Session ID from the host (Render/Koyeb/Railway) — rebuilt on every boot.
  sessionId: str(process.env.SESSION_ID || process.env.SESSION || process.env.BASE64_SESSION, ''),
  isProduction: process.env.NODE_ENV === 'production',

  ai: {
    provider: str(process.env.AI_PROVIDER, 'openai'),
    apiKey: str(process.env.AI_API_KEY, ''),
    baseUrl: str(process.env.AI_BASE_URL, 'https://api.openai.com/v1').replace(/\/+$/, ''),
    model: str(process.env.AI_MODEL, 'gpt-4o-mini'),
    systemPrompt: str(
      process.env.AI_SYSTEM_PROMPT,
      'You are Dark Eyes, a witty and helpful WhatsApp assistant. Keep replies short and conversational.'
    ),
    autoReply: bool(process.env.AI_AUTO_REPLY),
    get enabled() {
      return Boolean(this.apiKey)
    }
  },

  downloader: {
    apiUrl: str(process.env.DOWNLOAD_API_URL, ''),
    apiKey: str(process.env.DOWNLOAD_API_KEY, ''),
    get enabled() {
      return Boolean(this.apiUrl)
    }
  }
}

export const paths = {
  data: path.join(ROOT_DIR, 'data'),
  logs: path.join(ROOT_DIR, 'logs'),
  tmp: path.join(ROOT_DIR, 'data', 'tmp'),
  web: path.join(ROOT_DIR, 'src', 'web', 'public'),
  plugins: path.join(ROOT_DIR, 'src', 'plugins')
}

/** Create runtime folders. Safe to call repeatedly. */
export function ensureDirs() {
  for (const dir of [paths.data, paths.logs, paths.tmp, config.sessionDir, path.dirname(config.dbPath), config.backupDir]) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * Fail fast on configuration that cannot possibly work, and warn about the rest.
 * Returns the list of fatal problems (empty === good to boot).
 */
export function validateConfig() {
  const fatal = []
  const warnings = []

  if (config.owners.length === 0) {
    warnings.push('OWNER_NUMBER is empty — owner-only commands will be unusable.')
  }
  if (!config.prefix) {
    fatal.push('PREFIX must be at least one character.')
  }
  if (!Number.isFinite(config.port) || config.port < 1 || config.port > 65535) {
    fatal.push(`PORT "${process.env.PORT}" is not a valid port.`)
  }
  if (config.mode !== 'public' && config.mode !== 'self') {
    warnings.push(`BOT_MODE "${config.mode}" unknown, falling back to "public".`)
    config.mode = 'public'
  }
  if (!config.ai.apiKey) warnings.push('AI_API_KEY not set — AI plugins will stay dormant.')
  if (!config.downloader.apiUrl) warnings.push('DOWNLOAD_API_URL not set — media downloads will stay dormant.')
  if (!config.panelToken && config.isProduction) {
    warnings.push('PANEL_TOKEN is empty in production — anyone who can reach the port can pair or reset the bot.')
  }

  return { fatal, warnings }
}

export default config
