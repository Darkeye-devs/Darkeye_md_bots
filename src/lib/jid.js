/**
 * JID helpers — WhatsApp addresses look like 2348012345678:12@s.whatsapp.net
 */

/** Strip the device suffix and domain, returning bare digits. */
export function toNumber(jid = '') {
  if (!jid) return ''
  return String(jid).split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
}

export function normalizeJid(jid = '') {
  if (!jid) return ''
  const [user, server = 's.whatsapp.net'] = String(jid).split('@')
  return `${user.split(':')[0]}@${server}`
}

export const isGroupJid = (jid = '') => String(jid).endsWith('@g.us')
export const isUserJid = (jid = '') => !isGroupJid(jid) && !String(jid).endsWith('@broadcast')
export const isStatusJid = (jid = '') => String(jid) === 'status@broadcast'
export const isNewsletterJid = (jid = '') => String(jid).endsWith('@newsletter')

/** Turn digits into a user JID. */
export const toUserJid = (number = '') => `${String(number).replace(/[^0-9]/g, '')}@s.whatsapp.net`

/** Basic sanitiser for user supplied phone numbers (drops +, spaces, dashes). */
export function sanitizePhone(input = '') {
  return String(input).replace(/[^0-9]/g, '')
}

export function isValidPhone(input = '') {
  const digits = sanitizePhone(input)
  return digits.length >= 8 && digits.length <= 15
}

/** Format a number for humans: 2348012345678 -> +234 801 234 5678 */
export function prettyPhone(jidOrNumber = '') {
  const n = toNumber(jidOrNumber)
  if (n.length < 10) return n
  const cc = n.slice(0, n.length - 10)
  const rest = n.slice(-10)
  return `+${cc} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`.trim()
}
