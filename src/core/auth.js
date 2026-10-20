import fs from 'node:fs/promises'
import path from 'node:path'
import { useMultiFileAuthState } from '@whiskeysockets/baileys'
import { config } from '../config/index.js'
import { log } from './logger.js'
import { hydrateFromEnv } from './session.js'

const logger = log('auth')

export async function loadAuthState() {
  await fs.mkdir(config.sessionDir, { recursive: true })
  // Hosts like Render wipe the disk on every deploy: rebuild the folder from
  // SESSION_ID before Baileys reads it, so the bot comes back already paired.
  await hydrateFromEnv()
  return useMultiFileAuthState(config.sessionDir)
}

/** Has this instance ever been paired? (creds.json only exists after pairing) */
export async function sessionExists() {
  try {
    const raw = await fs.readFile(path.join(config.sessionDir, 'creds.json'), 'utf8')
    const creds = JSON.parse(raw)
    return Boolean(creds?.me?.id)
  } catch {
    return false
  }
}

/** Read the paired number without opening a socket. */
export async function pairedNumber() {
  try {
    const raw = await fs.readFile(path.join(config.sessionDir, 'creds.json'), 'utf8')
    const id = JSON.parse(raw)?.me?.id
    return id ? id.split('@')[0].split(':')[0] : null
  } catch {
    return null
  }
}

/** Nuke the session — the only cure for a "logged out" or corrupt auth folder. */
export async function resetSession() {
  logger.warn('resetting session folder %s', config.sessionDir)
  await fs.rm(config.sessionDir, { recursive: true, force: true })
  await fs.mkdir(config.sessionDir, { recursive: true })
}
