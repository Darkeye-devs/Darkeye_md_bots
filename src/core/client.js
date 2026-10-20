import makeWASocket, {
  Browsers,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason
} from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import { config } from '../config/index.js'
import { loadAuthState } from './auth.js'
import { bindSocket } from './connection.js'
import { baileysLogger, log } from './logger.js'
import { state, setStatus, resetPairingState } from './state.js'
import { safeEmit } from './event-bus.js'
import { sleep } from '../lib/time.js'

const logger = log('client')

let reconnectTimer = null
let connecting = false
const MAX_BACKOFF_MS = 30_000

/** Close a socket and strip its listeners so it cannot resurrect itself. */
function teardown(sock) {
  if (!sock) return
  try {
    sock.ev.removeAllListeners('connection.update')
    sock.ev.removeAllListeners('creds.update')
    sock.ev.removeAllListeners('messages.upsert')
    sock.ev.removeAllListeners('group-participants.update')
    sock.ev.removeAllListeners('call')
    sock.ev.removeAllListeners('messages.reaction')
  } catch {
    /* listener registry already gone */
  }
  try {
    sock.end(undefined)
  } catch {
    /* socket already closed */
  }
}

async function resolveVersion() {
  try {
    const { version, isLatest } = await fetchLatestBaileysVersion()
    if (!isLatest) logger.warn('a newer WhatsApp Web protocol version is available')
    return version
  } catch {
    logger.warn('could not fetch the latest protocol version, letting Baileys decide')
    return undefined
  }
}

/**
 * Create a raw socket (daily use) — connection lifecycle lives in connection.js.
 * @param {{ phone?: string|null, fresh?: boolean }} options
 */
export async function createSocket({ phone = null } = {}) {
  const { state: authState, saveCreds } = await loadAuthState()
  const version = await resolveVersion()
  state.version = version?.join('.')

  const sock = makeWASocket({
    version,
    logger: baileysLogger,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, baileysLogger)
    },
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
    emitOwnEvents: false,
    getMessage: async (key) => {
      const cached = (await import('./cache.js')).messageCache.get(key.id)
      return cached?.message ?? { conversation: '' }
    }
  })

  state.sock = sock
  // Always route reconnects through the backoff scheduler — calling connect()
  // directly here causes an unthrottled reconnect storm.
  bindSocket(sock, { onReconnect: () => scheduleReconnect() })

  // Persist credentials on every update, otherwise the session dies on restart.
  sock.ev.on('creds.update', async () => {
    try {
      await saveCreds()
    } catch (error) {
      logger.error({ err: error }, 'failed to save credentials')
    }
  })

  // Pairing code path: only valid before the account is registered.
  if (phone && !authState.creds.registered) {
    try {
      setStatus('pairing', { pairingPhone: phone, pairingRequestedAt: Date.now() })
      const code = await sock.requestPairingCode(phone)
      state.pairingCode = code
      safeEmit('pairing-code', { code, phone })
      logger.info('pairing code issued for %s', phone)
    } catch (error) {
      state.lastError = error.message
      logger.error({ err: error }, 'pairing code request failed')
      safeEmit('pairing-error', { message: error.message })
    }
  }

  return sock
}

/**
 * Public entrypoint: connect (or reconnect) with exponential backoff.
 * If the device is not paired, a socket is opened so a QR can be requested.
 */
export async function connect({ phone = null, fresh = false } = {}) {
  if (connecting) return state.sock
  if (state.sock && ['connected', 'connecting', 'pairing'].includes(state.status)) {
    return state.sock
  }

  connecting = true
  clearTimeout(reconnectTimer)

  try {
    // Always retire the previous socket first. Without this, every failed
    // reconnect leaves a live socket behind and each one keeps emitting
    // "close" — a reconnect storm that gets numbers banned.
    if (state.sock) {
      teardown(state.sock)
      state.sock = null
    }

    setStatus(phone ? 'pairing' : 'connecting')
    safeEmit('status', { status: state.status })
    const sock = await createSocket({ phone })
    return sock
  } catch (error) {
    state.lastError = error.message
    logger.error({ err: error }, 'socket creation failed')
    scheduleReconnect()
    return null
  } finally {
    connecting = false
  }
}

/** Exponential backoff: 2s, 4s, 8s, 16s, 30s, 30s… with jitter. */
export function backoffDelay(attempt = 1, jitter = Math.random()) {
  return Math.min(MAX_BACKOFF_MS, 2000 * 2 ** Math.min(Math.max(attempt - 1, 0), 4)) + jitter * 1000
}

/**
 * Single-flight reconnect with exponential backoff.
 * Calling this while a timer is already pending is a no-op, which is what
 * keeps a flapping connection from hammering WhatsApp.
 */
export const MAX_RECONNECT_ATTEMPTS = 12

export function scheduleReconnect() {
  if (reconnectTimer) return
  if (state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    state.lastError = `Gave up after ${MAX_RECONNECT_ATTEMPTS} reconnect attempts (${state.lastDisconnectCode ?? 'unknown'}).`
    logger.error('%s Reset the session from the panel if WhatsApp logged this number out.', state.lastError)
    setStatus('disconnected', { me: null })
    safeEmit('session:dead', { code: state.lastDisconnectCode, reason: 'reconnect limit' })
    return
  }
  state.reconnectAttempts += 1
  const wait = backoffDelay(state.reconnectAttempts)
  logger.warn('reconnecting in %ss (attempt %d)', Math.round(wait / 1000), state.reconnectAttempts)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, wait)
}

/** Cancel any pending reconnect (used by logout and by disconnect). */
export function cancelReconnect() {
  clearTimeout(reconnectTimer)
  reconnectTimer = null
}

/** Graceful shutdown — close the socket so WhatsApp doesn't hold a zombie session. */
export async function disconnect() {
  cancelReconnect()
  state.reconnectAttempts = 0
  try {
    state.sock?.end(undefined)
  } catch {
    /* already closed */
  }
  state.sock = null
  setStatus('disconnected')
  await sleep(200)
}

/** Convert a Baileys QR string into something a browser can <img>. */
export async function qrToDataUrl(qr) {
  try {
    return await QRCode.toDataURL(qr, {
      margin: 1,
      width: 420,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b0f14ff', light: '#ffffffff' }
    })
  } catch (error) {
    logger.error({ err: error }, 'QR render failed')
    return null
  }
}

export { DisconnectReason }
