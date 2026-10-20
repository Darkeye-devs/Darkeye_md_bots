import os from 'node:os'

/**
 * Single source of truth for live runtime state.
 * The web panel reads this; the bot writes to it. No imports from core/*.
 */
export const state = {
  status: 'disconnected', // disconnected | connecting | pairing | connected
  sock: null,
  me: null,
  qr: null,
  qrDataUrl: null,
  qrUpdatedAt: null,
  pairingCode: null,
  pairingPhone: null,
  pairingRequestedAt: null,
  connectedAt: null,
  startedAt: Date.now(),
  messagesHandled: 0,
  commandsHandled: 0,
  lastError: null,
  lastDisconnectCode: null,
  reconnectAttempts: 0,
  version: null
}

export function setStatus(status, extra = {}) {
  state.status = status
  Object.assign(state, extra)
}

export function resetPairingState() {
  state.qr = null
  state.qrDataUrl = null
  state.qrUpdatedAt = null
  state.pairingCode = null
  state.pairingPhone = null
  state.pairingRequestedAt = null
}

/** Safe snapshot for the API — never leak the socket object. */
export function snapshot() {
  return {
    status: state.status,
    botName: process.env.BOT_NAME || 'Dark Eyes',
    me: state.me
      ? { id: state.me.id, name: state.me.name ?? state.me.verifiedName ?? null, number: state.me.id?.split('@')[0]?.split(':')[0] }
      : null,
    qr: state.qr,
    qrDataUrl: state.qrDataUrl,
    qrUpdatedAt: state.qrUpdatedAt,
    pairingCode: state.pairingCode,
    pairingPhone: state.pairingPhone,
    connectedAt: state.connectedAt,
    startedAt: state.startedAt,
    uptimeMs: Date.now() - state.startedAt,
    sessionUptimeMs: state.connectedAt ? Date.now() - state.connectedAt : 0,
    messagesHandled: state.messagesHandled,
    commandsHandled: state.commandsHandled,
    lastError: state.lastError,
    lastDisconnectCode: state.lastDisconnectCode,
    reconnectAttempts: state.reconnectAttempts,
    version: state.version,
    node: process.version,
    platform: `${os.type()} ${os.arch()}`,
    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024)
  }
}
