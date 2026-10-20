import { toNumber, toUserJid, isValidPhone } from './jid.js'

/**
 * Work out who a command is aimed at.
 * Priority: @mention → quoted message author → raw number in the args.
 * @returns {{ jid: string, number: string } | null}
 */
export function resolveTarget(ctx, { index = 0, allowNumber = true } = {}) {
  if (ctx.mentions?.length) {
    const jid = ctx.mentions[0]
    return { jid, number: toNumber(jid) }
  }

  if (ctx.quoted?.key?.participant) {
    const jid = ctx.quoted.key.participant
    return { jid, number: toNumber(jid) }
  }

  if (!allowNumber) return null

  const candidate = ctx.args[index]?.replace(/[^0-9]/g, '')
  if (candidate && isValidPhone(candidate)) {
    return { jid: toUserJid(candidate), number: candidate }
  }

  return null
}

/** Every target a command could apply to (mentions, quoted, or one number). */
export function resolveTargets(ctx) {
  const targets = new Map()
  for (const jid of ctx.mentions ?? []) targets.set(toNumber(jid), jid)
  if (ctx.quoted?.key?.participant) {
    const jid = ctx.quoted.key.participant
    targets.set(toNumber(jid), jid)
  }
  if (targets.size === 0) {
    const candidate = ctx.args[0]?.replace(/[^0-9]/g, '')
    if (candidate && isValidPhone(candidate)) targets.set(candidate, toUserJid(candidate))
  }
  return [...targets.entries()].map(([number, jid]) => ({ jid, number }))
}

/** Verify a JID is actually in this group before acting on it. */
export async function requireMember(ctx, jid) {
  const meta = await ctx.groupMeta()
  if (!meta) return false
  return meta.participants.some((p) => toNumber(p.id) === toNumber(jid))
}
