/** Tiny TTL cache used for group metadata, message echoes and flood control. */
export class TTLMap {
  constructor({ ttl = 60_000, max = 500 } = {}) {
    this.ttl = ttl
    this.max = max
    this.map = new Map()
  }

  set(key, value) {
    if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value
      this.map.delete(oldest)
    }
    this.map.set(key, { value, expires: Date.now() + this.ttl })
    return value
  }

  get(key) {
    const hit = this.map.get(key)
    if (!hit) return undefined
    if (hit.expires < Date.now()) {
      this.map.delete(key)
      return undefined
    }
    return hit.value
  }

  has(key) {
    return this.get(key) !== undefined
  }

  delete(key) {
    return this.map.delete(key)
  }

  clear() {
    this.map.clear()
  }
}

/** Group metadata changes rarely — 10 minute cache is plenty. */
export const groupCache = new TTLMap({ ttl: 10 * 60_000, max: 500 })

/** Recently seen messages, used by anti-delete and media re-sends. */
export const messageCache = new TTLMap({ ttl: 15 * 60_000, max: 1000 })

/** Per-sender flood windows: senderId -> number[] timestamps. */
export const floodMap = new Map()

/** Per-user command cooldowns: `${sender}:${command}` -> expiry timestamp. */
export const cooldownMap = new Map()
