import { EventEmitter } from 'node:events'

/**
 * Internal pub/sub. Core emits, the web panel and plugins listen.
 * Events: 'status', 'qr', 'pairing-code', 'message', 'command',
 *         'connection', 'log', 'session:reset'
 */
export const bus = new EventEmitter()
bus.setMaxListeners(100)

/** Emit and never let a listener crash the bot. */
export function safeEmit(event, payload) {
  try {
    bus.emit(event, payload)
  } catch (error) {
    console.error(`[bus] listener for "${event}" threw:`, error?.message)
  }
}

export default bus
