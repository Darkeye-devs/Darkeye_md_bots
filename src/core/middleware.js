import { config } from '../config/index.js'
import { cooldownMap } from './cache.js'
import { availability } from './registry.js'
import { formatDuration } from '../lib/time.js'

/**
 * Guards that run, in order, before a plugin's execute().
 * Each returns { ok: true } to continue or { ok: false, reply?, silent? } to stop.
 */

/** BOT_MODE=self → only the owner can use commands. */
export function guardMode(ctx) {
  if (config.mode === 'self' && !ctx.isOwner) {
    return { ok: false, silent: true }
  }
  return { ok: true }
}

/** Declarative permissions declared by the plugin itself. */
export function guardPermissions(ctx) {
  const { plugin } = ctx

  if (plugin.ownerOnly && !ctx.isOwner) {
    return { ok: false, reply: '👁️ That one is owner-only.' }
  }
  if (plugin.groupOnly && !ctx.isGroup) {
    return { ok: false, reply: '👁️ This command only works inside a group.' }
  }
  if (plugin.privateOnly && ctx.isGroup) {
    return { ok: false, reply: '👁️ Slide into my DMs for that one.' }
  }
  if ((plugin.adminOnly || plugin.botAdminOnly) && !ctx.isGroup) {
    return { ok: false, reply: '👁️ Admin checks only make sense in a group.' }
  }
  if (plugin.adminOnly && !ctx.isAdmin && !ctx.isOwner) {
    return { ok: false, reply: '👁️ You need to be a group admin for that.' }
  }
  if (plugin.botAdminOnly && !ctx.isBotAdmin) {
    return { ok: false, reply: `👁️ I need admin rights here first — promote me and try again.` }
  }
  return { ok: true }
}

/** Plugin needs an API key or a system binary that this host doesn't have. */
export function guardCapabilities(ctx) {
  const { available, missing } = availability(ctx.plugin)
  if (available) return { ok: true }

  const friendly = missing
    .map((item) => (item === 'ffmpeg' ? 'ffmpeg (install it on the host)' : item))
    .join(', ')

  return {
    ok: false,
    reply: `👁️ *${ctx.command}* is installed but dormant.\n\nMissing: \`${friendly}\`\n_Add it to .env and restart — the command starts working immediately._`
  }
}

/** Per-user, per-command cooldown. */
export function guardCooldown(ctx) {
  const seconds = ctx.plugin.cooldown ?? 0
  if (!seconds || ctx.isOwner) return { ok: true }

  const key = `${ctx.sender}:${ctx.plugin.name}`
  const now = Date.now()
  const until = cooldownMap.get(key)

  if (until && until > now) {
    return {
      ok: false,
      reply: `⏳ Slow down — try *${ctx.command}* again in ${formatDuration(until - now)}.`
    }
  }

  cooldownMap.set(key, now + seconds * 1000)
  // opportunistic cleanup so the map cannot grow without bound
  if (cooldownMap.size > 5000) {
    for (const [k, v] of cooldownMap) if (v < now) cooldownMap.delete(k)
  }
  return { ok: true }
}

export const middlewares = [guardMode, guardPermissions, guardCapabilities, guardCooldown]

/**
 * Run the pipeline. Returns { ok, reply?, silent? }.
 */
export function runMiddleware(ctx) {
  for (const guard of middlewares) {
    const result = guard(ctx)
    if (!result.ok) return result
  }
  return { ok: true }
}
