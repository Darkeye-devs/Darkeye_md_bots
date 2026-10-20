/**
 * Shared constants. Nothing here reads from the environment.
 */
export const CATEGORIES = {
  general: { label: 'General', icon: '🌐' },
  owner: { label: 'Owner', icon: '👑' },
  moderation: { label: 'Moderation', icon: '🛡️' },
  ai: { label: 'Intelligence', icon: '🧠' },
  tools: { label: 'Tools', icon: '🧰' },
  media: { label: 'Media', icon: '🎬' },
  fun: { label: 'Fun', icon: '🎲' },
  uncategorized: { label: 'Others', icon: '📦' }
}

export const LIMITS = {
  /** Default per-user cooldown in seconds when a plugin doesn't declare one */
  defaultCooldown: 3,
  /** Max characters of a command message we will consider */
  maxMessageLength: 8000,
  /** Flood guard: max messages inside the window */
  floodMaxMessages: 12,
  floodWindowMs: 10_000,
  /** Sticker size cap (WhatsApp rejects bigger) */
  maxStickerBytes: 1000 * 1024,
  /** AI conversation memory kept per chat */
  aiMemoryTurns: 12,
  aiMemoryTtlMs: 1000 * 60 * 60 * 6,
  /** Warns before removal, can be overridden by MAX_WARNS */
  defaultMaxWarns: 3
}

export const GROUP_SETTING_DEFAULTS = {
  antilink: 'off',   // off | warn | delete | kick
  antispam: 0,
  welcome: 1,
  goodbye: 1,
  mute: 0,
  antidelete: 0
}

export const MEDIA_TYPES = ['image', 'video', 'audio', 'sticker', 'document']
