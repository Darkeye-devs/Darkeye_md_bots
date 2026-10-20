import { UserError } from '../../lib/errors.js'
import { formatDuration, formatDate } from '../../lib/time.js'
import { toNumber } from '../../lib/jid.js'

/** Parse "10m", "2h", "1d", "90s" into milliseconds. */
function parseDuration(input = '') {
  const match = input.match(/^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i)
  if (!match) return null
  const value = Number(match[1])
  const unit = match[2].toLowerCase()[0]
  return value * ({ s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 0)
}

const notes = (ctx) => ctx.db.getDb()

export default [
  {
    name: 'remind',
    aliases: ['reminder', 'remindme'],
    category: 'misc',
    description: 'Set a reminder — the bot pings you when it is due',
    usage: '.remind 10m take the pills',
    examples: ['.remind 30m call mum', '.remind 2h check the oven', '.remind 1d rent is due'],
    cooldown: 5,
    async execute(ctx) {
      const [when, ...rest] = ctx.args
      const ms = parseDuration(when)
      if (!ms) throw new UserError('When? Use 10m, 2h or 1d.', { hint: 'Example: .remind 30m call the client' })
      const message = rest.join(' ')
      if (!message) throw new UserError('What should I remind you about?')
      if (ms > 30 * 86_400_000) throw new UserError('I can only remember up to 30 days ahead.')

      const id = ctx.db.reminders.add({ chatJid: ctx.chat, userJid: ctx.sender, message, dueAt: Date.now() + ms })
      return ctx.reply(
        `⏰ Reminder #${id} set.\n\n*${message}*\n_In ${formatDuration(ms)} — ${formatDate(new Date(Date.now() + ms), ctx.config.timezone)}_`
      )
    }
  },

  {
    name: 'reminders',
    aliases: ['myreminders'],
    category: 'misc',
    description: 'Your pending reminders',
    cooldown: 3,
    async execute(ctx) {
      const pending = ctx.services.scheduler.pendingFor(ctx.chat).filter((r) => r.user_jid === ctx.sender)
      if (!pending.length) return ctx.reply('⏰ You have no pending reminders.')
      return ctx.reply(`⏰ *YOUR REMINDERS*\n\n${pending.map((r) => `#${r.id} — *${r.message}* _in ${r.in}_`).join('\n')}`)
    }
  },

  {
    name: 'delreminder',
    aliases: ['cancelreminder'],
    category: 'misc',
    description: 'Cancel a reminder by its number',
    usage: '.delreminder 3',
    cooldown: 3,
    async execute(ctx) {
      const id = Number.parseInt(ctx.args[0], 10)
      if (!Number.isFinite(id)) throw new UserError('Which reminder number?')
      const reminder = ctx.services.scheduler.pendingFor(ctx.chat).find((r) => r.id === id && r.user_jid === ctx.sender)
      if (!reminder) throw new UserError(`You have no reminder #${id}.`)
      ctx.db.reminders.markDelivered(id)
      return ctx.reply(`✅ Reminder #${id} cancelled.`)
    }
  },

  {
    name: 'note',
    aliases: ['savenote'],
    category: 'misc',
    description: 'Save a note for yourself',
    usage: '.note Title | body text',
    cooldown: 3,
    async execute(ctx) {
      const text = ctx.argsText || ctx.quotedText
      if (!text) throw new UserError('Usage: .note Title | body')
      const [title, ...body] = text.split('|').map((s) => s.trim())
      const content = body.length ? body.join('|') : title
      notes(ctx)
        .prepare('INSERT INTO notes (chat_jid, user_jid, title, body, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(ctx.chat, ctx.sender, body.length ? title : null, content, Date.now())
      return ctx.reply(`📝 Note saved${body.length ? `: *${title}*` : ''}.`)
    }
  },

  {
    name: 'notes',
    aliases: ['mynotes'],
    category: 'misc',
    description: 'List your notes',
    cooldown: 3,
    async execute(ctx) {
      const rows = notes(ctx)
        .prepare('SELECT id, title, body, created_at FROM notes WHERE chat_jid = ? AND user_jid = ? ORDER BY id DESC LIMIT 20')
        .all(ctx.chat, ctx.sender)
      if (!rows.length) return ctx.reply('📝 No notes yet. Add one: .note Title | body')
      const lines = rows.map((n) => `• *#${n.id}* ${n.title ?? n.body.slice(0, 40)}\n   _${new Date(n.created_at).toDateString()}_`).join('\n')
      return ctx.reply(`📝 *YOUR NOTES*\n\n${lines}\n\n_Read one: ${ctx.prefix}shownote <id>_`)
    }
  },

  {
    name: 'shownote',
    aliases: ['getnote'],
    category: 'misc',
    description: 'Read a note in full',
    usage: '.shownote 2',
    cooldown: 2,
    async execute(ctx) {
      const id = Number.parseInt(ctx.args[0], 10)
      if (!Number.isFinite(id)) throw new UserError('Which note number?')
      const note = notes(ctx).prepare('SELECT * FROM notes WHERE id = ? AND chat_jid = ? AND user_jid = ?').get(id, ctx.chat, ctx.sender)
      if (!note) throw new UserError(`You have no note #${id}.`)
      return ctx.reply(`📝 ${note.title ? `*${note.title}*\n\n` : ''}${note.body}`)
    }
  },

  {
    name: 'delnote',
    category: 'misc',
    description: 'Delete one of your notes',
    usage: '.delnote 2',
    cooldown: 2,
    async execute(ctx) {
      const id = Number.parseInt(ctx.args[0], 10)
      if (!Number.isFinite(id)) throw new UserError('Which note number?')
      const changes = notes(ctx).prepare('DELETE FROM notes WHERE id = ? AND chat_jid = ? AND user_jid = ?').run(id, ctx.chat, ctx.sender).changes
      if (!changes) throw new UserError(`You have no note #${id}.`)
      return ctx.reply(`🗑️ Note #${id} deleted.`)
    }
  },

  {
    name: 'todo',
    aliases: ['addtodo'],
    category: 'misc',
    description: 'Add a to-do item',
    usage: '.todo buy fuel',
    cooldown: 2,
    async execute(ctx) {
      if (!ctx.argsText) throw new UserError('What should I add?')
      notes(ctx).prepare('INSERT INTO todos (chat_jid, user_jid, body, created_at) VALUES (?, ?, ?, ?)').run(ctx.chat, ctx.sender, ctx.argsText, Date.now())
      return ctx.reply(`✅ Added to your list: *${ctx.argsText}*`)
    }
  },

  {
    name: 'todos',
    aliases: ['mytodos', 'list-todo'],
    category: 'misc',
    description: 'Your to-do list',
    cooldown: 2,
    async execute(ctx) {
      const rows = notes(ctx).prepare('SELECT * FROM todos WHERE chat_jid = ? AND user_jid = ? ORDER BY done, id').all(ctx.chat, ctx.sender)
      if (!rows.length) return ctx.reply('📋 Your list is empty. Add one: .todo buy fuel')
      const lines = rows.map((t) => `${t.done ? '✅' : '⬜'} *#${t.id}* ${t.done ? `~${t.body}~` : t.body}`).join('\n')
      return ctx.reply(`📋 *TO-DO*\n\n${lines}\n\n_Done: ${ctx.prefix}donetodo <id> · Delete: ${ctx.prefix}deltodo <id>_`)
    }
  },

  {
    name: 'donetodo',
    aliases: ['donetask'],
    category: 'misc',
    description: 'Tick something off your list',
    usage: '.donetodo 2',
    cooldown: 2,
    async execute(ctx) {
      const id = Number.parseInt(ctx.args[0], 10)
      if (!Number.isFinite(id)) throw new UserError('Which item number?')
      const changes = notes(ctx).prepare('UPDATE todos SET done = 1 WHERE id = ? AND chat_jid = ? AND user_jid = ?').run(id, ctx.chat, ctx.sender).changes
      if (!changes) throw new UserError(`No item #${id} on your list.`)
      return ctx.reply(`✅ Item #${id} done.`)
    }
  },

  {
    name: 'deltodo',
    aliases: ['deltask'],
    category: 'misc',
    description: 'Remove a to-do item',
    usage: '.deltodo 2',
    cooldown: 2,
    async execute(ctx) {
      const id = Number.parseInt(ctx.args[0], 10)
      if (!Number.isFinite(id)) throw new UserError('Which item number?')
      const changes = notes(ctx).prepare('DELETE FROM todos WHERE id = ? AND chat_jid = ? AND user_jid = ?').run(id, ctx.chat, ctx.sender).changes
      if (!changes) throw new UserError(`No item #${id} on your list.`)
      return ctx.reply(`🗑️ Item #${id} removed.`)
    }
  },

  {
    name: 'afk',
    category: 'misc',
    description: 'Mark yourself away — the bot tells people why',
    usage: '.afk sleeping',
    cooldown: 3,
    async execute(ctx) {
      const reason = ctx.argsText || 'away'
      notes(ctx)
        .prepare(
          `INSERT INTO afk (chat_jid, user_jid, reason, since) VALUES (?, ?, ?, ?)
           ON CONFLICT(chat_jid, user_jid) DO UPDATE SET reason = excluded.reason, since = excluded.since`
        )
        .run(ctx.chat, ctx.sender, reason, Date.now())
      return ctx.reply(`😴 You are now AFK: _${reason}_`)
    }
  },

  {
    name: 'unafk',
    aliases: ['back'],
    category: 'misc',
    description: 'Come back from away',
    cooldown: 2,
    async execute(ctx) {
      const changes = notes(ctx).prepare('DELETE FROM afk WHERE chat_jid = ? AND user_jid = ?').run(ctx.chat, ctx.sender).changes
      if (!changes) return ctx.reply('You were not marked away.')
      return ctx.reply('👋 Welcome back.')
    }
  },

  {
    name: 'afklist',
    aliases: ['awaylist'],
    category: 'misc',
    description: 'Who in this chat is away',
    cooldown: 3,
    async execute(ctx) {
      const rows = notes(ctx).prepare('SELECT * FROM afk WHERE chat_jid = ?').all(ctx.chat)
      if (!rows.length) return ctx.reply('Nobody is away right now.')
      const lines = rows.map((r) => `• @${toNumber(r.user_jid)} — _${r.reason}_ (${formatDuration(Date.now() - r.since)})`).join('\n')
      return ctx.reply(`😴 *AWAY*\n\n${lines}`, { mentions: rows.map((r) => r.user_jid) })
    }
  },

  {
    name: 'timer',
    aliases: ['stopwatch'],
    category: 'misc',
    description: 'Count down from N seconds or minutes',
    usage: '.timer 5m',
    cooldown: 3,
    async execute(ctx) {
      const ms = parseDuration(ctx.args[0] ?? '')
      if (!ms) throw new UserError('How long? Example: .timer 5m')
      if (ms > 3_600_000) throw new UserError('Maximum is 1 hour.')

      await ctx.reply(`⏳ Timer started for *${formatDuration(ms)}*.`)
      setTimeout(() => {
        ctx
          .say({ text: `⏰ @${ctx.senderNumber} your *${formatDuration(ms)}* timer is done.`, mentions: [ctx.sender] })
          .catch(() => {})
      }, ms)
    }
  }
]
