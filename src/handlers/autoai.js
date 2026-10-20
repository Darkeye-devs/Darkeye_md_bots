import { config } from '../config/index.js'
import { ai } from '../services/index.js'
import { log } from '../core/logger.js'

const logger = log('autoai')

/**
 * Optional: reply to every private message with the configured AI.
 * Group chats are never auto-replied — that would be unbearable in practice.
 */
export async function handleAiAutoReply(sock, m) {
  if (!config.ai.autoReply || !ai.enabled) return false
  if (m.isGroup || m.isStatus || m.fromMe) return false
  if (!m.text || m.text.length < 2) return false

  try {
    await sock.sendPresenceUpdate('composing', m.chat)
    const answer = await ai.chat(m.chat, m.text, { sender: m.sender })
    await sock.sendMessage(m.chat, { text: answer }, { quoted: m.raw })
    return true
  } catch (error) {
    logger.error('auto-reply failed: %s', error.message)
    return false
  } finally {
    await sock.sendPresenceUpdate('paused', m.chat).catch(() => {})
  }
}
