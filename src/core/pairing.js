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
const RATE_LIMIT = { windowMs: 60 * 60_000, max: 6 }

/** phone -> pair session */
const sessions = new Map()
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
  const active = [...sessions.values()].find(
    (s) => now < s.expiresAt && (s.code || now - s.createdAt < 60_000)
  )
  if (active) {
    const wait = Math.max(5, Math.ceil(((active.code ? active.expiresAt : active.createdAt + 60_000) - now) / 1000))
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
    code: state.pairingCode,
    claimed: false
  }
  sessions.set(phone, record)

  // WhatsApp answers asynchronously — and only if the number is really on WhatsApp.
  for (let i = 0; i < 32 && !state.pairingCode; i++) {
    await new Promise((r) => setTimeout(r, 250))
  }
  record.code = state.pairingCode

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

export function cleanupPairings() {
  const now = Date.now()
  for (const [phone, record] of sessions) {
    if (now > record.expiresAt + 10 * 60_000) sessions.delete(phone)
  }
}

export const pairingConfig = { PAIR_TTL_MS, RATE_LIMIT }
export default { startPublicPairing, getPublicPairing, claimSession, rateLimited, cleanupPairings }
