import { db } from '../services/index.js'
import { log } from '../core/logger.js'
import { toNumber } from '../lib/jid.js'
import { groupCache } from '../core/cache.js'

const logger = log('group')

/** Welcome / goodbye / member bookkeeping on join, leave, promote, demote. */
export async function handleGroupParticipants(sock, payload) {
  const { id, participants, action } = payload
  if (!id || !participants?.length) return

  groupCache.delete(id)
  const settings = db.groups.settings(id)
  db.chats.touch(id)

  let meta = null
  try {
    meta = await sock.groupMetadata(id)
    db.members.sync(id, meta.participants ?? [])
  } catch (error) {
    logger.debug('metadata refresh failed for %s: %s', id, error.message)
  }

  const groupName = meta?.subject ?? 'this group'

  for (const participant of participants) {
    const jid = typeof participant === 'string' ? participant : participant.id
    if (!jid) continue
    const name = `@${toNumber(jid)}`

    if (action === 'add' && Number(settings.welcome)) {
      const custom = settings.welcome_text
      const text = custom
        ? custom.replace(/\{user\}/g, name).replace(/\{group\}/g, groupName)
        : `👁️ Welcome ${name} to *${groupName}*.\n\nRead the rules, stay sharp — I'm watching.`
      await sock.sendMessage(id, { text, mentions: [jid] }).catch(() => {})
    }

    if (action === 'remove' && Number(settings.goodbye)) {
      const custom = settings.goodbye_text
      const text = custom
        ? custom.replace(/\{user\}/g, name).replace(/\{group\}/g, groupName)
        : `👁️ ${name} left *${groupName}*. The eye misses nothing.`
      await sock.sendMessage(id, { text, mentions: [jid] }).catch(() => {})
    }

    if (action === 'promote') {
      await sock.sendMessage(id, { text: `👑 ${name} is now an admin.`, mentions: [jid] }).catch(() => {})
    }

    if (action === 'demote') {
      await sock.sendMessage(id, { text: `👁️ ${name} is no longer an admin.`, mentions: [jid] }).catch(() => {})
    }
  }
}
