import { downloadMediaMessage } from '@whiskeysockets/baileys'
import config from '../config/index.js'
import { config as appConfig } from '../config/index.js'
import * as db from '../services/database.js'
import { toNumber } from '../lib/jid.js'
import { log } from './logger.js'
import { extractMentions } from '../lib/mentions.js'
import { groupCache } from './cache.js'

/**
 * Build the `ctx` object handed to every plugin.
 * This is the plugin API surface — keep it stable and well documented.
 */
export function buildContext({ sock, m, plugin, command, args, argsText, prefix, text, services }) {
  const logger = log(`plugin:${plugin?.name ?? 'unknown'}`)

  const ctx = {
    // ── identity ─────────────────────────────
    sock,
    m,
    msg: m.raw,
    plugin,
    command,
    args,
    argsText,
    prefix,
    text,
    raw: m.raw,

    // ── chat ─────────────────────────────────
    chat: m.chat,
    sender: m.sender,
    senderNumber: m.senderNumber,
    pushName: m.pushName,
    isGroup: m.isGroup,
    mentions: m.mentions,
    quoted: m.quoted,
    quotedText: m.quotedText,
    quotedType: m.quotedType,
    media: m.media,

    // ── permissions ──────────────────────────
    isOwner: false,
    isAdmin: false,
    isBotAdmin: false,
    isFromMe: m.fromMe,

    // ── services & data ──────────────────────
    config,
    appConfig,
    db,
    services,
    logger,

    // ── helpers filled in below ──────────────
    reply: null,
    replyMedia: null,
    send: null,
    react: null,
    download: null,
    groupMeta: null,
    tagAll: null,
    mentionText: null
  }

  // ── reply / send ───────────────────────────
  const send = async (jid, content, options = {}) => sock.sendMessage(jid, content, options)

  ctx.send = send

  /** Reply to the triggering message (quoted by default). */
  ctx.reply = async (content, options = {}) => {
    const payload = typeof content === 'string' ? { text: content } : content
    return send(m.chat, payload, { quoted: m.raw, ...options })
  }

  /** Reply silently (no quote) — useful in groups for warnings. */
  ctx.say = async (content, options = {}) => {
    const payload = typeof content === 'string' ? { text: content } : content
    return send(m.chat, payload, options)
  }

  /** Send media with a caption. */
  ctx.replyMedia = async (buffer, mimetype, caption = '', extra = {}) => {
    const isImage = mimetype.startsWith('image')
    const isVideo = mimetype.startsWith('video')
    const isAudio = mimetype.startsWith('audio')
    const key = isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'document'
    return send(
      m.chat,
      { [key]: buffer, mimetype, caption: caption || undefined, ...(key === 'document' ? { fileName: extra.fileName } : {}) },
      { quoted: m.raw, ...extra }
    )
  }

  /** React to the triggering message. */
  ctx.react = async (emoji) => {
    try {
      return await sock.sendMessage(m.chat, { react: { text: emoji, key: m.raw.key } })
    } catch (error) {
      logger.debug('reaction failed: %s', error.message)
      return null
    }
  }

  /** Download the media attached to this message, or to the quoted one. */
  ctx.download = async ({ quoted = false } = {}) => {
    const target = quoted ? m.quoted : m.raw
    if (!target?.message) return null
    try {
      return await downloadMediaMessage(
        target,
        'buffer',
        {},
        { logger, reuploadRequest: sock.updateMediaMessage }
      )
    } catch (error) {
      logger.error('download failed: %s', error.message)
      return null
    }
  }

  /** Group metadata (cached for 10 minutes). */
  ctx.groupMeta = async () => {
    if (!m.isGroup) return null
    const cached = groupCache.get(m.chat)
    if (cached) return cached
    try {
      const meta = await sock.groupMetadata(m.chat)
      groupCache.set(m.chat, meta)
      return meta
    } catch (error) {
      logger.warn('groupMetadata failed: %s', error.message)
      return null
    }
  }

  /** Mention every participant. */
  ctx.tagAll = async (message = '', { withJids = true } = {}) => {
    const meta = await ctx.groupMeta()
    if (!meta) return null
    const jids = meta.participants.map((p) => p.id)
    const tags = withJids ? jids.map((j) => `@${toNumber(j)}`).join(' ') : ''
    return send(m.chat, {
      text: message ? `${message}\n\n${tags}` : tags,
      mentions: jids
    })
  }

  ctx.mentionText = (prefixText = '') => ctx.mentions.map((j) => `@${toNumber(j)}`).join(' ') || prefixText

  return ctx
}

/**
 * Resolve the sender's admin status inside a group.
 * Called by the router because it is async and only needed for group commands.
 */
export async function resolvePermissions(ctx) {
  const ownerNumbers = config.owners
  const number = toNumber(ctx.sender)

  ctx.isOwner =
    ctx.isFromMe ||
    ownerNumbers.includes(number) ||
    ownerNumbers.includes(ctx.senderNumber)

  if (!ctx.isGroup) return ctx

  const meta = await ctx.groupMeta()
  if (!meta?.participants) return ctx

  const me = toNumber(ctx.sock.user?.id ?? '')
  const find = (jid) => meta.participants.find((p) => toNumber(p.id) === toNumber(jid))

  const meParticipant = find(me)
  ctx.isBotAdmin = meParticipant?.admin === 'admin' || meParticipant?.admin === 'superadmin'

  const senderParticipant = find(ctx.sender)
  ctx.isAdmin =
    senderParticipant?.admin === 'admin' ||
    senderParticipant?.admin === 'superadmin' ||
    ctx.isOwner

  ctx.participants = meta.participants
  return ctx
}

export default buildContext
