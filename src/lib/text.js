/** Text utilities used across plugins. */

/**
 * Split a command line into arguments, honouring "quoted strings".
 * `.ban "bad user" spam` -> ["bad user", "spam"]
 */
export function parseArgs(input = '') {
  const args = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let match
  while ((match = re.exec(input)) !== null) {
    args.push(match[1] ?? match[2] ?? match[3])
  }
  return args
}

export function truncate(text = '', max = 120, suffix = '…') {
  const s = String(text).replace(/\s+/g, ' ').trim()
  return s.length <= max ? s : s.slice(0, max - suffix.length).trimEnd() + suffix
}

export const capitalize = (s = '') => s.charAt(0).toUpperCase() + s.slice(1)

export function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** WhatsApp monospace */
export const mono = (s = '') => `\`\`\`${s}\`\`\``
/** WhatsApp bold */
export const bold = (s = '') => `*${s}*`
/** WhatsApp italic */
export const italic = (s = '') => `_${s}_`
export const strike = (s = '') => `~${s}~`

/**
 * A tidy box for menus and reports.
 * frame('Dark Eyes', ['line one', 'line two'])
 */
export function frame(title, lines = [], { width = 34, char = '─' } = {}) {
  const top = `╭${char.repeat(width)}╮`
  const bottom = `╰${char.repeat(width)}╯`
  const body = lines.map((line) => `│ ${truncate(line, width - 3).padEnd(width - 2)}│`)
  return [top, `│ ${bold(title).padEnd(width - 2)}│`, ...body, bottom].join('\n')
}

/** Simple human list: "a, b and c" */
export function listSentence(items = []) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

/** Word-boundary check for "on/off/true/false/enable/disable" style flags. */
export function parseToggle(value = '') {
  const v = String(value).trim().toLowerCase()
  if (['on', 'enable', 'enabled', 'true', '1', 'yes'].includes(v)) return true
  if (['off', 'disable', 'disabled', 'false', '0', 'no'].includes(v)) return false
  return null
}

/** Very small deterministic hash, handy for "ship" style features. */
export function hashString(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function pick(arr = []) {
  return arr[Math.floor(Math.random() * arr.length)]
}
