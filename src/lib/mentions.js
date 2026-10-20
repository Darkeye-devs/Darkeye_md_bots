import { toNumber, normalizeJid } from './jid.js'

/** Pull every JID a message mentions (from contextInfo or text @tags). */
export function extractMentions(msg = {}) {
  const content = msg.message ?? {}
  const type = Object.keys(content)[0]
  const body = type ? content[type] : {}
  const ctx = body?.contextInfo ?? {}
  const jids = new Set()

  for (const jid of ctx.mentionedJid ?? []) jids.add(normalizeJid(jid))
  const text = body?.text ?? body?.caption ?? ''
  for (const [, number] of text.matchAll(/@(\d{8,15})/g)) {
    jids.add(`${number}@s.whatsapp.net`)
  }
  return [...jids]
}

/** Build the mention list needed to tag everyone in a group. */
export function everyoneMentions(participants = []) {
  const jids = participants
    .map((p) => normalizeJid(p.id ?? p.phoneNumber ?? ''))
    .filter((jid) => jid && !jid.startsWith('0@s.whatsapp.net'))
  return { mentions: jids, text: jids.map((j) => `@${toNumber(j)}`).join(' ') }
}
