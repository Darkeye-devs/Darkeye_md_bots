import { config } from '../config/index.js'
import { db } from '../services/index.js'
import { log } from '../core/logger.js'
import { floodMap } from '../core/cache.js'
import { LIMITS } from '../config/constants.js'
import { toNumber } from '../lib/jid.js'

const logger = log('automod')

const LINK_PATTERN = /(https?:\/\/|www\.)\S+|chat\.whatsapp\.com\/\S+|t\.me\/\S+/i

/**
 * The only guards that are enabled are the ones with a genuine, working
 * implementation. Everything here operates on real message data.
 */
export async function runAutoModeration(sock, m) {
  if (!m.isGroup || m.fromMe) return false
  if (m.sender === '0@s.whatsapp.net') return false

  const settings = db.groups.settings(m.chat)
  const senderNumber = toNumber(m.sender)

  const isProtected = () => {
    const owners = config.owners
    return owners.includes(senderNumber)
  }

  if (isProtected()) return false

  // Admins bypass every group guard.
  const meta = await sock.groupMetadata(m.chat).catch(() => null)
  const participant = meta?.participants?.find((p) => toNumber(p.id) === senderNumber)
  const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin'
  if (isAdmin) return false

  const botIsAdmin = (() => {
    const me = toNumber(sock.user?.id ?? '')
    const self = meta?.participants?.find((p) => toNumber(p.id) === me)
    return self?.admin === 'admin' || self?.admin === 'superadmin'
  })()

  const punish = async (reason, { deleteOnly = true } = {}) => {
    if (botIsAdmin) {
      await sock.sendMessage(m.chat, { delete: m.raw.key }).catch(() => {})
    } else if (deleteOnly) {
      logger.debug('cannot delete in %s — bot is not admin', m.chat)
    }

    if (settings.antilink === 'warn' || (!deleteOnly && settings.max_warns)) {
      const count = db.warns.add(m.chat, m.sender, reason, sock.user?.id)
      const max = settings.max_warns ?? config.maxWarns
      await sock
        .sendMessage(m.chat, {
          text: `👁️ *${m.pushName ?? senderNumber}* — ${reason}\nWarning ${count}/${max}.`
        })
        .catch(() => {})

      if (count >= max && botIsAdmin) {
        await sock
          .groupParticipantsUpdate(m.chat, [m.sender], 'remove')
          .catch((error) => logger.warn('could not remove %s: %s', senderNumber, error.message))
        db.warns.reset(m.chat, m.sender)
      }
    }
    return true
  }

  // ── mute ───────────────────────────────────
  if (settings.mute) {
    // Mute only applies to non-admins (already checked above).
    await sock.sendMessage(m.chat, { delete: m.raw.key }).catch(() => {})
    return true
  }

  // ── antilink ───────────────────────────────
  if (settings.antilink !== 'off' && LINK_PATTERN.test(m.text)) {
    if (settings.antilink === 'kick' && botIsAdmin) {
      await sock.sendMessage(m.chat, { delete: m.raw.key }).catch(() => {})
      await sock.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch(() => {})
      await sock.sendMessage(m.chat, { text: `👁️ Links are banned here. *${m.pushName ?? senderNumber}* was removed.` })
      return true
    }
    if (settings.antilink === 'delete') {
      await sock.sendMessage(m.chat, { delete: m.raw.key }).catch(() => {})
      return true
    }
    return punish('Links are not allowed in this group.')
  }

  // ── antispam (flood) ───────────────────────
  if (settings.antispam) {
    const key = `${m.chat}:${m.sender}`
    const now = Date.now()
    const hits = (floodMap.get(key) ?? []).filter((t) => now - t < LIMITS.floodWindowMs)
    hits.push(now)
    floodMap.set(key, hits)

    if (hits.length > LIMITS.floodMaxMessages) {
      floodMap.delete(key)
      if (botIsAdmin) await sock.sendMessage(m.chat, { delete: m.raw.key }).catch(() => {})
      return punish('Slow down — that is spam.')
    }
  }

  // ── antimedia / antisticker ────────────────
  if (settings.antimedia && ['image', 'video', 'audio', 'voice', 'document'].includes(m.media)) {
    return punish('Media is restricted here.')
  }
  if (settings.antisticker && m.media === 'sticker') {
    return punish('Stickers are restricted here.')
  }

  // ── antibadword (per-group word list stored in settings) ──
  const badWords = db.settings.get(`badwords:${m.chat}`, [])
  if (badWords.length && m.text) {
    const lower = m.text.toLowerCase()
    const hit = badWords.find((w) => lower.includes(w.toLowerCase()))
    if (hit) return punish(`That word is not allowed here.`)
  }

  // ── antiforward (Baileys exposes forwardingScore) ──
  if (settings.antiforward && m.mediaMessage?.contextInfo?.forwardingScore > 0) {
    return punish('Forwarded messages are restricted here.')
  }

  return false
}
