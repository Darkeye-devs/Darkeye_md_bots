import { db } from '../services/index.js'
import { log } from '../core/logger.js'
import { config } from '../config/index.js'
import { toNumber } from '../lib/jid.js'

const logger = log('call')

/** Reject incoming calls when the (global) anti-call setting is on. */
export async function handleCall(sock, calls) {
  if (!db.settings.get('anticall', false)) return

  for (const call of calls) {
    if (call.status !== 'offer') continue
    const caller = call.from
    const number = toNumber(caller)
    if (config.owners.includes(number)) continue

    try {
      await sock.rejectCall(call.id, call.from)
      await sock.sendMessage(caller, {
        text: '👁️ I do not take calls. Send a message instead.'
      })
    } catch (error) {
      logger.warn('could not reject call from %s: %s', number, error.message)
    }
  }
}
