/** A user-facing error: its message is safe to print in a chat. */
export class UserError extends Error {
  constructor(message, { hint } = {}) {
    super(message)
    this.name = 'UserError'
    this.hint = hint
    this.expose = true
  }
}

export class ConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ConfigError'
  }
}

/** Convert any thrown value into something friendly for a chat reply. */
export function friendlify(error) {
  if (error instanceof UserError) return error.hint ? `${error.message}\n\n_${error.hint}_` : error.message
  if (error?.status === 401 || error?.status === 403) return 'That service rejected our credentials.'
  if (error?.name === 'AbortError') return 'That request took too long and was cancelled.'
  if (error?.code === 'ENOTFOUND') return 'Network problem — I could not reach that server.'
  return 'Something went sideways while running that. Try again in a moment.'
}
