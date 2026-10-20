import { parseToggle } from '../../lib/text.js'
import { UserError } from '../../lib/errors.js'
import { bold } from '../../lib/text.js'

/** Guards that map 1:1 onto real code in handlers/automod.js */
const GUARDS = {
  antilink: { key: 'antilink', type: 'level', values: ['off', 'delete', 'warn', 'kick'] },
  antispam: { key: 'antispam', type: 'bool' },
  antimedia: { key: 'antimedia', type: 'bool' },
  antisticker: { key: 'antisticker', type: 'bool' },
  antiforward: { key: 'antiforward', type: 'bool' },
  welcome: { key: 'welcome', type: 'bool' },
  goodbye: { key: 'goodbye', type: 'bool' }
}

function makeGuardCommand(name) {
  const spec = GUARDS[name]
  return {
    name,
    category: 'moderation',
    description: `Turn ${name} on or off for this group`,
    usage: `.${name} on|off${spec.type === 'level' ? '|delete|warn|kick' : ''}`,
    adminOnly: true,
    groupOnly: true,
    cooldown: 2,
    async execute(ctx) {
      const current = ctx.db.groups.settings(ctx.chat)[spec.key]

      if (!ctx.args.length) {
        return ctx.reply(
          `👁️ *${name}* is currently *${spec.type === 'bool' ? (Number(current) ? 'on' : 'off') : current}*.\n` +
            `_Change it: ${ctx.prefix}${name} ${spec.type === 'bool' ? 'on' : 'warn'}_`
        )
      }

      const value = ctx.args[0].toLowerCase()

      if (spec.type === 'level') {
        if (!spec.values.includes(value)) {
          throw new UserError(`Choose one of: ${spec.values.join(', ')}`)
        }
        ctx.db.groups.set(ctx.chat, spec.key, value)
        return ctx.reply(`👁️ *${name}* set to *${value}*.`)
      }

      const flag = parseToggle(value)
      if (flag === null) throw new UserError('Use *on* or *off*.')
      ctx.db.groups.set(ctx.chat, spec.key, flag ? 1 : 0)
      return ctx.reply(`👁️ *${name}* is now *${flag ? 'on' : 'off'}*.`)
    }
  }
}

const togglePlugins = Object.keys(GUARDS).map(makeGuardCommand)

export default [
  ...togglePlugins,

  {
    name: 'setwelcome',
    aliases: ['welcomemsg'],
    category: 'moderation',
    description: 'Customise the welcome message ({user} and {group} placeholders)',
    usage: '.setwelcome Welcome {user} to {group}!',
    adminOnly: true,
    groupOnly: true,
    cooldown: 3,
    async execute(ctx) {
      if (!ctx.argsText) {
        const current = ctx.db.groups.settings(ctx.chat).welcome_text
        return ctx.reply(`Current welcome:\n\n${current ?? '_default message_'}\n\n_Placeholders: {user} {group}_`)
      }
      ctx.db.groups.set(ctx.chat, 'welcome_text', ctx.argsText)
      return ctx.reply('👁️ Welcome message saved.')
    }
  },

  {
    name: 'setgoodbye',
    aliases: ['goodbyemsg'],
    category: 'moderation',
    description: 'Customise the goodbye message',
    usage: '.setgoodbye Bye {user}!',
    adminOnly: true,
    groupOnly: true,
    cooldown: 3,
    async execute(ctx) {
      if (!ctx.argsText) {
        const current = ctx.db.groups.settings(ctx.chat).goodbye_text
        return ctx.reply(`Current goodbye:\n\n${current ?? '_default message_'}`)
      }
      ctx.db.groups.set(ctx.chat, 'goodbye_text', ctx.argsText)
      return ctx.reply('👁️ Goodbye message saved.')
    }
  },

  {
    name: 'badword',
    aliases: ['addbadword', 'antibadword'],
    category: 'moderation',
    description: 'Manage this group’s banned word list',
    usage: '.badword add <word> | remove <word> | list',
    adminOnly: true,
    groupOnly: true,
    cooldown: 2,
    async execute(ctx) {
      const [action = 'list', ...rest] = ctx.args
      const key = `badwords:${ctx.chat}`
      const words = ctx.db.settings.get(key, [])
      const word = rest.join(' ').toLowerCase().trim()

      if (action === 'list') {
        return ctx.reply(
          words.length
            ? `🚫 *Banned words* (${words.length})\n\n${words.join(', ')}`
            : 'No banned words yet. Add one: .badword add stupid'
        )
      }

      if (!word) throw new UserError('Which word?')

      if (action === 'add') {
        if (words.includes(word)) throw new UserError('That word is already banned.')
        ctx.db.settings.set(key, [...words, word])
        return ctx.reply(`🚫 Banned *${word}*.`)
      }

      if (action === 'remove' || action === 'delete') {
        ctx.db.settings.set(key, words.filter((w) => w !== word))
        return ctx.reply(`👁️ Unbanned *${word}*.`)
      }

      throw new UserError('Use: .badword add <word> | remove <word> | list')
    }
  },

  {
    name: 'anticall',
    category: 'moderation',
    description: 'Globally reject incoming calls (owner)',
    usage: '.anticall on|off',
    ownerOnly: true,
    cooldown: 2,
    async execute(ctx) {
      const current = ctx.db.settings.get('anticall', false)
      if (!ctx.args.length) {
        return ctx.reply(`📵 Anti-call is *${current ? 'on' : 'off'}*.`)
      }
      const flag = parseToggle(ctx.args[0])
      if (flag === null) throw new UserError('Use *on* or *off*.')
      ctx.db.settings.set('anticall', flag)
      return ctx.reply(`📵 Anti-call is now *${flag ? 'on' : 'off'}*.`)
    }
  },

  {
    name: 'guardstatus',
    aliases: ['settings'],
    category: 'moderation',
    description: 'Show every guard setting for this group',
    groupOnly: true,
    cooldown: 4,
    async execute(ctx) {
      const s = ctx.db.groups.settings(ctx.chat)
      const onOff = (v) => (Number(v) ? '✅ on' : '❌ off')
      return ctx.reply(
        `🛡️ ${bold('GUARDS FOR THIS GROUP')}\n\n` +
          `*antilink:* ${s.antilink}\n` +
          `*antispam:* ${onOff(s.antispam)}\n` +
          `*antimedia:* ${onOff(s.antimedia)}\n` +
          `*antisticker:* ${onOff(s.antisticker)}\n` +
          `*antiforward:* ${onOff(s.antiforward)}\n` +
          `*welcome:* ${onOff(s.welcome)}\n` +
          `*goodbye:* ${onOff(s.goodbye)}\n` +
          `*max warns:* ${s.max_warns}\n\n` +
          `_Change with ${ctx.prefix}<guard> on|off_`
      )
    }
  }
]
