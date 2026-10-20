import crypto from 'node:crypto'
import { connect, disconnect, cancelReconnect } from './client.js'
import { state } from './state.js'
import { exportSession } from './session.js'
import { log } from './logger.js'

const logger = log('pairing')

/**
 * Public pairing sessions for the hosted landing page.
 *
 * Anyone can ask for a pairing code — that is the point of a public site — but
 * the resulting Session ID is only handed back to the holder of the opaque
 * `pairToken` that was issued with the request. Tokens are short-lived and
 * single-use.
 */

const PAIR_TTL_MS = 5 * 60_000
/**
 * WhatsApp pairing codes are only good for about a minute. The pairing *record*
 * may live longer (the browser keeps polling), but the code itself must be
 * entered fast — so the countdown shown to users uses this, not PAIR_TTL_MS.
 */
const CODE_TTL_MS = 60_000
const RATE_LIMIT = { windowMs: 60 * 60_000, max: 6 }

/** phone -> pair session (8-digit code flow) */
const sessions = new Map()
/** pairingId -> pair session (QR flow — there is no phone number to key on yet) */
const qrSessions = new Map()
/** ip -> timestamps[] */
const rateBuckets = new Map()

export function rateLimited(ip) {
  const now = Date.now()
  const hits = (rateBuckets.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs)
  hits.push(now)
  rateBuckets.set(ip, hits)
  if (rateBuckets.size > 5000) {
    for (const [key, list] of rateBuckets) {
      if (!list.some((t) => now - t < RATE_LIMIT.windowMs)) rateBuckets.delete(key)
    }
  }
  return hits.length > RATE_LIMIT.max
}

const token = () => crypto.randomBytes(24).toString('base64url')

/** Only one WhatsApp socket can exist, so only one pairing at a time. */
export function pairingBusy() {
  if (state.status === 'connected') return 'This bot is already linked to a number. Ask the owner to log out first.'

  const now = Date.now()
  // Busy if a session is live OR was created in the last minute — a request that
  // has not produced a code yet is still holding the single WhatsApp socket.
  const active = [...sessions.values(), ...qrSessions.values()].find(
    (s) => now < s.expiresAt && (s.code || s.dataUrl || now - s.createdAt < 90_000)
  )
  if (active) {
    const deadline = active.code || active.dataUrl
      ? active.expiresAt
      : active.createdAt + 90_000
    const wait = Math.max(5, Math.ceil((deadline - now) / 1000))
    return `Another pairing is in progress. Try again in ${wait}s.`
  }
  return null
}

export async function startPublicPairing(phone) {
  const busy = pairingBusy()
  if (busy) {
    const error = new Error(busy)
    error.status = 409
    throw error
  }

  // fresh socket, no local session interference
  cancelReconnect()
  await disconnect()
  await connect({ phone, fresh: true })

  const record = {
    phone,
    pairToken: token(),
    createdAt: Date.now(),
    expiresAt: Date.now() + PAIR_TTL_MS,
    codeIssuedAt: null,
    code: state.pairingCode,
    claimed: false
  }
  sessions.set(phone, record)

  // WhatsApp answers asynchronously — and only if the number is really on WhatsApp.
  for (let i = 0; i < 32 && !state.pairingCode; i++) {
    await new Promise((r) => setTimeout(r, 250))
  }
  record.code = state.pairingCode
  record.codeIssuedAt = state.pairingCode ? Date.now() : null

  if (!record.code) {
    // Nothing came back: release the socket so the next attempt is not blocked.
    sessions.delete(phone)
    await disconnect()
    logger.warn('no pairing code returned for %s', phone)
    throw Object.assign(
      new Error(
        'WhatsApp did not return a pairing code. Check that the number is on WhatsApp, has the country code, and try again in a minute.'
      ),
      { status: 422, noCode: true }
    )
  }

  logger.info('public pairing started for %s', phone)
  return record
}

export function getPublicPairing(phone) {
  const record = sessions.get(phone)
  if (!record) return null

  const connected = state.status === 'connected' && state.me?.id?.startsWith(phone)
  return {
    phone: record.phone,
    code: record.code ?? state.pairingCode,
    expiresAt: record.expiresAt,
    secondsLeft: Math.max(0, Math.ceil((record.expiresAt - Date.now()) / 1000)),
    // How long the *code* is still good for — this is what the UI counts down.
    codeSecondsLeft: record.codeIssuedAt
      ? Math.max(0, Math.ceil((record.codeIssuedAt + CODE_TTL_MS - Date.now()) / 1000))
      : 0,
    codeExpired: Boolean(record.codeIssuedAt && Date.now() > record.codeIssuedAt + CODE_TTL_MS),
    status: connected ? 'connected' : state.status,
    connected,
    number: connected ? phone : null
  }
}

/**
 * Hand the Session ID to whoever proves they started this pairing.
 * A token can only be redeemed once.
 */
export async function claimSession(phone, pairToken) {
  const record = sessions.get(phone)
  if (!record) throw Object.assign(new Error('No pairing found for that number.'), { status: 404 })
  if (record.claimed) throw Object.assign(new Error('This session was already claimed. Start a new pairing.'), { status: 410 })
  if (pairToken !== record.pairToken) throw Object.assign(new Error('Wrong pairing token.'), { status: 403 })
  if (state.status !== 'connected') throw Object.assign(new Error('Not connected yet — finish the code in WhatsApp first.'), { status: 409 })

  const sessionId = await exportSession()
  record.claimed = true
  sessions.delete(phone)
  logger.info('session claimed for %s', phone)
  return sessionId
}

// ── QR flow ─────────────────────────────────
// Some numbers never receive an 8-digit code (WhatsApp hides it for accounts
// with two-step verification quirks, and it can simply time out). The QR path
// exists so those users are not stuck: the page shows the same QR the phone
// would scan in Settings → Linked devices.

/**
 * Store a freshly generated QR. Split out from startPublicQrPairing so the
 * lifecycle can be tested without opening a socket.
 */
export function registerQrPairing(dataUrl) {
  const record = {
    pairingId: crypto.randomUUID(),
    qrToken: token(),
    createdAt: Date.now(),
    expiresAt: Date.now() + PAIR_TTL_MS,
    dataUrl,
    claimed: false
  }
  qrSessions.set(record.pairingId, record)
  return record
}

/** Public, secret-free view of a QR pairing. `snapshot` defaults to live state. */
export function readQrPairing(pairingId, snapshot = state) {
  const record = qrSessions.get(pairingId)
  if (!record) return null

  const connected = snapshot.status === 'connected'
  return {
    pairingId: record.pairingId,
    status: connected ? 'connected' : snapshot.status,
    connected,
    // WhatsApp rotates the QR roughly every 20s; hand back the newest one.
    dataUrl: connected ? null : snapshot.qrDataUrl ?? record.dataUrl,
    expiresAt: record.expiresAt,
    secondsLeft: Math.max(0, Math.ceil((record.expiresAt - Date.now()) / 1000))
  }
}

/**
 * Hand over the Session ID for a QR pairing. Same single-use token rule as the
 * code flow: only the browser that started the pairing can collect it.
 */
export async function claimQrSession(pairingId, qrToken, { exporter = exportSession, snapshot = state } = {}) {
  const record = qrSessions.get(pairingId)
  if (!record) throw Object.assign(new Error('No QR pairing found. Start again.'), { status: 404 })
  if (record.claimed) throw Object.assign(new Error('This session was already claimed.'), { status: 410 })
  if (qrToken !== record.qrToken) throw Object.assign(new Error('Wrong pairing token.'), { status: 403 })
  if (snapshot.status !== 'connected') {
    throw Object.assign(new Error('Not connected yet — scan the QR in WhatsApp first.'), { status: 409 })
  }

  const sessionId = await exporter()
  record.claimed = true
  qrSessions.delete(pairingId)
  logger.info('session claimed via QR')
  return sessionId
}

/** Open a socket in QR mode and wait for WhatsApp's first QR image. */
export async function startPublicQrPairing() {
  const busy = pairingBusy()
  if (busy) throw Object.assign(new Error(busy), { status: 409 })

  cancelReconnect()
  await disconnect()
  state.qrDataUrl = null
  await connect({ fresh: true }) // no phone -> Baileys asks for a QR

  for (let i = 0; i < 80 && !state.qrDataUrl; i++) {
    await new Promise((r) => setTimeout(r, 250))
  }

  if (!state.qrDataUrl) {
    await disconnect()
    logger.warn('no QR returned by WhatsApp')
    throw Object.assign(
      new Error('WhatsApp did not return a QR code. Try again in a minute, or use the 8-digit code instead.'),
      { status: 422, noQr: true }
    )
  }

  const record = registerQrPairing(state.qrDataUrl)
  logger.info('public QR pairing started')
  return record
}


export function cleanupPairings() {
  const now = Date.now()
  for (const [phone, record] of sessions) {
    if (now > record.expiresAt + 10 * 60_000) sessions.delete(phone)
  }
  for (const [id, record] of qrSessions) {
    if (now > record.expiresAt + 10 * 60_000) qrSessions.delete(id)
  }
}

export const pairingConfig = { PAIR_TTL_MS, CODE_TTL_MS, RATE_LIMIT }
export default {
  startPublicPairing,
  getPublicPairing,
  claimSession,
  startPublicQrPairing,
  readQrPairing,
  claimQrSession,
  rateLimited,
  cleanupPairings
}
