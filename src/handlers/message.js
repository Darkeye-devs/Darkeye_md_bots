import { state } from '../core/state.js'
import { config } from '../config/index.js'
import { parseMessage } from '../lib/parse.js'
import { route, detectCommand } from '../core/router.js'
import { messageCache } from '../core/cache.js'
import { log } from '../core/logger.js'
import { db, services } from '../services/index.js'
import { runAutoModeration } from './automod.js'
import { handleAiAutoReply } from './autoai.js'

const logger = log('message')

export async function handleMessagesUpsert(sock, payload) {
  const { messages, type } = payload
  if (!Array.isArray(messages)) return
  if (type && type !== 'notify') return // ignore history sync

  for (const raw of messages) {
    try {
      await handleOne(sock, raw)
    } catch (error) {
      logger.error({ err: error }, 'failed to handle message')
    }
  }
}

async function handleOne(sock, raw) {
  if (!raw?.message) return

  const m = parseMessage(sock, raw)
  if (!m || m.isStatus) return

  state.messagesHandled += 1
  messageCache.set(m.id, { message: m.message, chat: m.chat, sender: m.sender, media: m.media })
  db.chats.touch(m.chat)
  if (m.sender) db.users.touch(m.sender, m.pushName)

  if (config.autoRead && !m.fromMe) sock.readMessages([raw.key]).catch(() => {})

  // Guards may delete the message and stop everything else.
  const blocked = await runAutoModeration(sock, m)
  if (blocked) return

  const isCommand = Boolean(detectCommand(m.text))
  if (isCommand) {
    const result = await route({ sock, m, services })
    if (result.handled) return
  }

  if (!isCommand && (await handleAiAutoReply(sock, m))) return
}
