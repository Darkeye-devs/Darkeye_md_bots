/** Duration and date helpers. */

/** 3725000 -> "1h 2m 5s" */
export function formatDuration(ms = 0) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const parts = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m) parts.push(`${m}m`)
  if (!d && !h) parts.push(`${s}s`)
  return parts.join(' ') || '0s'
}

export const uptimeSince = (start) => formatDuration(Date.now() - start)

export function formatDate(date = new Date(), timeZone = 'Africa/Lagos') {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date instanceof Date ? date : new Date(date))
  } catch {
    return new Date(date).toISOString()
  }
}

export function timeAgo(date, now = Date.now()) {
  const diff = now - new Date(date).getTime()
  if (diff < 60_000) return 'just now'
  return `${formatDuration(diff)} ago`
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** HH:MM:SS for logs */
export const clock = () => new Date().toTimeString().slice(0, 8)
