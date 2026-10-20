import { DisconnectReason } from '@whiskeysockets/baileys'
import { log } from './logger.js'
import { state, setStatus, resetPairingState } from './state.js'
import { safeEmit } from './event-bus.js'
import { qrToDataUrl } from './client.js'
import { resetSession } from './auth.js'
import { handleMessagesUpsert } from '../handlers/message.js'
import { handleGroupParticipants } from '../handlers/group.js'
import { handleCall } from '../handlers/call.js'
import { handleReaction } from '../handlers/reaction.js'

const logger = log('connection')

/** Reasons that mean "you must pair again" rather than "just reconnect". */
const DEAD_SESSION_CODES = new Set([
  DisconnectReason.loggedOut,
  401, // unauthorized
  403, // forbidden / banned
  405, // registration rejected
  500 // bad session
])

/**
 * Wire every socket event exactly once.
 * @param {import('@whiskeysockets/baileys').WASocket} sock
 * @param {{ onReconnect?: () => void }} hooks
 */
export function bindSocket(sock, hooks = {}) {
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      const dataUrl = await qrToDataUrl(qr)
      setStatus(state.status === 'connected' ? 'pairing' : 'pairing', {
        qr,
        qrDataUrl: dataUrl,
        qrUpdatedAt: Date.now()
      })
      safeEmit('qr', { qr, dataUrl })
      logger.info('new QR available — open the panel to scan it')
    }

    if (connection === 'connecting') {
      if (state.status !== 'pairing') setStatus('connecting')
      safeEmit('status', { status: state.status })
    }

    if (connection === 'open') {
      setStatus('connected', {
        me: sock.user,
        connectedAt: Date.now(),
        reconnectAttempts: 0,
        lastError: null
      })
      resetPairingState()
      logger.info('connected as %s', sock.user?.id?.split('@')[0] ?? 'unknown')
      safeEmit('status', { status: 'connected', me: sock.user })
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode ?? lastDisconnect?.error?.status ?? 0
      const reason = Object.entries(DisconnectReason).find(([, v]) => v === code)?.[0] ?? 'unknown'
      state.lastDisconnectCode = code
      state.lastError = lastDisconnect?.error?.message ?? `connection closed (${reason})`

      logger.warn('connection closed: %s (code %s)', reason, code)
      safeEmit('status', { status: 'disconnected', code, reason })

      if (DEAD_SESSION_CODES.has(code)) {
        setStatus('disconnected', { me: null })
        logger.error('WhatsApp rejected this session (%s). Reset the session from the panel to pair again.', reason)
        try {
          await resetSession()
        } catch (error) {
          logger.error({ err: error }, 'could not clear the dead session folder')
        }
        safeEmit('session:dead', { code, reason })
        return
      }

      setStatus('disconnected', { me: null })
      hooks.onReconnect?.()
    }
  })

  sock.ev.on('messages.upsert', async (payload) => {
    try {
      await handleMessagesUpsert(sock, payload)
    } catch (error) {
      logger.error({ err: error }, 'messages.upsert handler crashed')
    }
  })

  sock.ev.on('group-participants.update', async (payload) => {
    try {
      await handleGroupParticipants(sock, payload)
    } catch (error) {
      logger.error({ err: error }, 'group-participants handler crashed')
    }
  })

  sock.ev.on('call', async (calls) => {
    try {
      await handleCall(sock, calls)
    } catch (error) {
      logger.error({ err: error }, 'call handler crashed')
    }
  })

  sock.ev.on('messages.reaction', async (payload) => {
    try {
      await handleReaction(sock, payload)
    } catch (error) {
      logger.error({ err: error }, 'reaction handler crashed')
    }
  })

  sock.ev.on('messages.update', () => {
    // Reserved for anti-delete / read receipts. Kept to avoid unhandled events.
  })

  sock.ev.on('presence.update', () => {
    // Reserved. Presence tracking is intentionally opt-in via plugins.
  })

  return sock
}
