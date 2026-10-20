import { resolveTarget } from '../../lib/target.js'
import { UserError } from '../../lib/errors.js'
import { toNumber } from '../../lib/jid.js'

export default [
  {
    name: 'warn',
    category: 'moderation',
    description: 'Warn a member (auto-removes at the group limit)',
    usage: '.warn @user [reason]',
    adminOnly: true,
    groupOnly: true,
    cooldown: 2,
    async execute(ctx) {
      const target = resolveTarget(ctx)
      if (!target) throw new UserError('Tag the member to warn.')
      if (target.number === ctx.senderNumber) throw new UserError('Warning yourself is not a thing.')

      const reason = ctx.args.slice(1).join(' ') || 'no reason given'
      const settings = ctx.db.groups.settings(ctx.chat)
      const max = settings.max_warns ?? ctx.config.maxWarns
      const count = ctx.db.warns.add(ctx.chat, target.jid, reason, ctx.sender)

      if (count >= max) {
        if (ctx.isBotAdmin) {
          await ctx.sock.groupParticipantsUpdate(ctx.chat, [target.jid], 'remove')
          ctx.db.warns.reset(ctx.chat, target.jid)
          return ctx.reply(
            `👁️ @${target.number} reached ${max}/${max} warnings and was removed.\n_Reason: ${reason}_`,
            { mentions: [target.jid] }
          )
        }
        return ctx.reply(
          `👁️ @${target.number} hit ${max} warnings, but I need admin rights to remove them.`,
          { mentions: [target.jid] }
        )
      }

      return ctx.reply(
        `⚠️ *Warning ${count}/${max}* for @${target.number}\n_${reason}_`,
        { mentions: [target.jid] }
      )
    }
  },

  {
    name: 'unwarn',
    aliases: ['resetwarn'],
    category: 'moderation',
    description: 'Remove one warning (or all) from a member',
    usage: '.unwarn @user',
    adminOnly: true,
    groupOnly: true,
    cooldown: 2,
    async execute(ctx) {
      const target = resolveTarget(ctx)
      if (!target) throw new UserError('Tag the member.')
      const removed = ctx.db.warns.reset(ctx.chat, target.jid)
      if (!removed) throw new UserError(`@${target.number} has no warnings.`, { hint: undefined })
      return ctx.reply(`👁️ Cleared ${removed} warning(s) for @${target.number}.`, { mentions: [target.jid] })
    }
  },

  {
    name: 'warnings',
    aliases: ['listwarn', 'warns'],
    category: 'moderation',
    description: 'See the warnings on a member',
    usage: '.warnings @user',
    groupOnly: true,
    cooldown: 3,
    async execute(ctx) {
      const target = resolveTarget(ctx) ?? { jid: ctx.sender, number: ctx.senderNumber }
      const list = ctx.db.warns.list(ctx.chat, target.jid)
      if (!list.length) return ctx.reply(`👁️ @${target.number} is clean — no warnings.`, { mentions: [target.jid] })

      const lines = list
        .slice(0, 10)
        .map((w, i) => `${i + 1}. ${w.reason ?? 'no reason'} — ${new Date(w.created_at).toDateString()}`)
      return ctx.reply(
        `⚠️ *Warnings for @${target.number}* (${list.length})\n\n${lines.join('\n')}`,
        { mentions: [target.jid] }
      )
    }
  },

  {
    name: 'rmwarn',
    aliases: ['clearwarns'],
    category: 'moderation',
    description: 'Clear every warning in this group',
    adminOnly: true,
    groupOnly: true,
    cooldown: 5,
    async execute(ctx) {
      const removed = ctx.db.warns.reset(ctx.chat)
      return ctx.reply(`👁️ Cleared ${removed} warning(s) in this group.`)
    }
  }
]
