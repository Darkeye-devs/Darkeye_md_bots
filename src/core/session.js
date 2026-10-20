import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config/index.js'
import { log } from './logger.js'

const logger = log('session')

/**
 * Session ID — how an MD bot survives a host that wipes its disk.
 *
 * The whole Baileys auth folder (creds + keys) is bundled into one JSON object
 * and base64-encoded, prefixed with "DarkEyes~". A user pastes that single
 * string into SESSION_ID on Render/Koyeb/Railway and the bot boots already
 * paired — no QR, no persistent disk, no terminal.
 *
 * It is a credential. Anyone holding it controls the WhatsApp account.
 */
export const SESSION_PREFIX = 'DarkEyes~'
export const SESSION_ENV_KEYS = ['SESSION_ID', 'SESSION', 'BASE64_SESSION', 'CREDS']

/** Files worth keeping in a session bundle. */
const KEEP = (name) => name.endsWith('.json')

/** Strip whitespace, quotes and stray prefixes people paste in by accident. */
export function cleanSessionId(raw = '') {
  return String(raw)
    .trim()
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/\s+/g, '')
    .replace(/^(DarkEyes|darkeyes|DARK_EYES)~/, SESSION_PREFIX)
}

/** Read the env var whichever name the host uses. */
export function sessionFromEnv() {
  for (const key of SESSION_ENV_KEYS) {
    const value = process.env[key]
    if (value && value.trim().length > 40) return cleanSessionId(value)
  }
  return ''
}

/**
 * Bundle the current auth folder into a Session ID.
 * @returns {Promise<string>}
 */
export async function exportSession() {
  let files
  try {
    files = await fs.readdir(config.sessionDir)
  } catch {
    throw new Error('No session folder yet — pair a number first.')
  }

  const bundle = {}
  for (const name of files) {
    if (!KEEP(name)) continue
    try {
      const raw = await fs.readFile(path.join(config.sessionDir, name), 'utf8')
      bundle[name] = JSON.parse(raw)
    } catch {
      // a half-written key file is not fatal — skip it
    }
  }

  if (!bundle['creds.json']) throw new Error('creds.json is missing — this account is not paired.')
  if (!bundle['creds.json']?.me?.id) throw new Error('creds.json has no account id — pairing did not finish.')

  const json = JSON.stringify(bundle)
  const id = SESSION_PREFIX + Buffer.from(json, 'utf8').toString('base64')
  logger.info('exported session id (%d files, %d bytes)', Object.keys(bundle).length, id.length)
  return id
}

/**
 * Write a Session ID into the auth folder.
 * @param {string} raw
 * @returns {Promise<{ files: number, number: string|null }>}
 */
export async function importSession(raw) {
  const id = cleanSessionId(raw)
  if (!id) throw new Error('Empty session ID.')

  const base64 = id.startsWith(SESSION_PREFIX) ? id.slice(SESSION_PREFIX.length) : id

  let bundle
  try {
    bundle = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'))
  } catch {
    throw new Error('That session ID is not valid base64 JSON.')
  }

  if (!bundle || typeof bundle !== 'object') throw new Error('Session ID did not decode to an object.')
  if (!bundle['creds.json']) throw new Error('Session ID is missing creds.json.')
  if (!bundle['creds.json']?.me?.id) throw new Error('Session ID has no account id — pair again.')

  await fs.mkdir(config.sessionDir, { recursive: true })
  let written = 0
  for (const [name, value] of Object.entries(bundle)) {
    // guard against a malicious bundle trying to write outside the folder
    if (name.includes('/') || name.includes('\\') || name.includes('..')) continue
    if (!KEEP(name)) continue
    await fs.writeFile(path.join(config.sessionDir, name), JSON.stringify(value))
    written++
  }

  const number = String(bundle['creds.json'].me.id).split('@')[0].split(':')[0]
  logger.info('imported session for %s (%d files)', number, written)
  return { files: written, number }
}

/** Has a usable session already? */
export async function hasLocalSession() {
  try {
    const creds = JSON.parse(await fs.readFile(path.join(config.sessionDir, 'creds.json'), 'utf8'))
    return Boolean(creds?.me?.id)
  } catch {
    return false
  }
}

/**
 * Boot-time hydration: if the host gave us a SESSION_ID, write it before
 * Baileys ever looks at the folder. Returns a status object for the logs.
 */
export async function hydrateFromEnv({ force = false } = {}) {
  const id = sessionFromEnv()
  if (!id) return { hydrated: false, reason: 'no SESSION_ID set' }

  if (!force && (await hasLocalSession())) {
    return { hydrated: false, reason: 'local session already present' }
  }

  try {
    const result = await importSession(id)
    return { hydrated: true, ...result }
  } catch (error) {
    logger.error('SESSION_ID could not be loaded: %s', error.message)
    return { hydrated: false, reason: error.message, error }
  }
}

/** Metadata for the panel — never the raw ID unless explicitly asked. */
export async function sessionSummary() {
  const local = await hasLocalSession()
  const env = Boolean(sessionFromEnv())
  let number = null
  let size = 0

  if (local) {
    try {
      const creds = JSON.parse(await fs.readFile(path.join(config.sessionDir, 'creds.json'), 'utf8'))
      number = String(creds.me.id).split('@')[0].split(':')[0]
      const files = await fs.readdir(config.sessionDir)
      size = files.filter(KEEP).length
    } catch {
      /* ignore */
    }
  }

  return { paired: local, number, files: size, fromEnv: env }
}

export default { exportSession, importSession, hydrateFromEnv, sessionSummary, sessionFromEnv, cleanSessionId, SESSION_PREFIX }
