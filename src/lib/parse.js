import { getContentType } from '@whiskeysockets/baileys'
import { isGroupJid, normalizeJid, toNumber } from './jid.js'
import { extractMentions } from './mentions.js'

/** Peel off wrappers (ephemeral, view-once, edited) until we reach real content. */
export function unwrapMessage(message = {}) {
  let msg = message
  for (let i = 0; i < 5; i++) {
    if (!msg || typeof msg !== 'object') return {}
    const type = Object.keys(msg)[0]
    if (!type) return {}
    const wrappers = [
      'ephemeralMessage',
      'viewOnceMessage',
      'viewOnceMessageV2',
      'viewOnceMessageV2Extension',
      'documentWithCaptionMessage',
      'editedMessage'
    ]
    if (wrappers.includes(type)) {
      msg = msg[type]?.message ?? {}
      continue
    }
    return msg
  }
  return msg
}

/** Best-effort plain text of a message (body or caption). */
export function getText(message = {}) {
  const msg = unwrapMessage(message)
  const type = getContentType(msg)
  const body = type ? msg[type] : null
  if (!body) return ''

  switch (type) {
    case 'conversation':
      return body
    case 'extendedTextMessage':
      return body.text ?? ''
    case 'imageMessage':
    case 'videoMessage':
    case 'documentMessage':
      return body.caption ?? ''
    case 'buttonsResponseMessage':
      return body.selectedButtonId ?? ''
    case 'listResponseMessage':
      return body.singleSelectReply?.selectedRowId ?? ''
    case 'templateButtonReplyMessage':
      return body.selectedId ?? ''
    case 'reactionMessage':
      return body.text ?? ''
    default:
      return ''
  }
}

/** Coarse media classification used by plugins and anti-media guards. */
export function getMediaType(message = {}) {
  const msg = unwrapMessage(message)
  const type = getContentType(msg)
  if (!type) return null
  if (type === 'imageMessage') return 'image'
  if (type === 'videoMessage') return 'video'
  if (type === 'audioMessage') return msg.audioMessage?.ptt ? 'voice' : 'audio'
  if (type === 'stickerMessage') return 'sticker'
  if (type === 'documentMessage' || type === 'documentWithCaptionMessage') return 'document'
  if (type.includes('image')) return 'image'
  if (type.includes('video')) return 'video'
  if (type.includes('audio')) return 'audio'
  return null
}

/** Raw media descriptor of the message itself. */
export function getMediaMessage(message = {}) {
  const msg = unwrapMessage(message)
  const type = getContentType(msg)
  return type ? { type, ...(msg[type] ?? {}) } : null
}

export function getContextInfo(message = {}) {
  const msg = unwrapMessage(message)
  const type = getContentType(msg)
  return (type && msg[type]?.contextInfo) || {}
}

/** Wrap the quoted message so it can be re-downloaded or re-sent. */
export function buildQuoted(msg, contextInfo = {}) {
  if (!contextInfo?.quotedMessage) return null
  return {
    key: {
      remoteJid: msg.key.remoteJid,
      fromMe: contextInfo.participant === normalizeJid(msg.key.remoteJid) ? true : false,
      id: contextInfo.stanzaId,
      participant: contextInfo.participant
    },
    message: unwrapMessage(contextInfo.quotedMessage)
  }
}

/**
 * Normalise a raw Baileys message into the shape the router and plugins expect.
 * Returns null for messages we should ignore (protocol traffic, empty bodies).
 */
export function parseMessage(sock, msg) {
  if (!msg?.message) return null

  const inner = unwrapMessage(msg.message)
  const type = getContentType(inner)
  if (!type) return null
  if (type === 'protocolMessage' || type === 'pollUpdateMessage' || type === 'senderKeyDistributionMessage') {
    return null
  }

  const chat = normalizeJid(msg.key.remoteJid ?? '')
  const isGroup = isGroupJid(chat)
  const sender = normalizeJid(
    (msg.key.fromMe ? sock.user?.id : msg.key.participant) ?? msg.key.remoteJid ?? ''
  )
  const fromMe = Boolean(msg.key.fromMe)
  const text = getText(msg.message).trim()
  const contextInfo = getContextInfo(msg.message)
  const media = getMediaType(msg.message)

  return {
    raw: msg,
    message: inner,
    type,
    id: msg.key.id,
    chat,
    sender,
    senderNumber: toNumber(sender),
    pushName: msg.pushName ?? null,
    fromMe,
    isGroup,
    isStatus: chat === 'status@broadcast',
    text,
    media,
    mediaMessage: getMediaMessage(msg.message),
    mentions: extractMentions(msg),
    quoted: buildQuoted(msg, contextInfo),
    quotedType: contextInfo?.quotedMessage ? getMediaType(contextInfo.quotedMessage) : null,
    quotedText: contextInfo?.quotedMessage ? getText(contextInfo.quotedMessage) : '',
    quotedParticipant: contextInfo?.participant ? normalizeJid(contextInfo.participant) : null,
    isViewOnce: Boolean(msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2),
    timestamp: Number(msg.messageTimestamp ?? Date.now() / 1000) * 1000
  }
}
