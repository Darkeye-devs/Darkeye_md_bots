import os from 'node:os'
import { config } from '../../config/index.js'
import { state } from '../../core/state.js'
import { registryStats, capabilities } from '../../core/registry.js'
import { summary } from '../../services/database.js'
import { renderStats } from '../../lib/menu.js'
import { formatDuration, formatDate } from '../../lib/time.js'
import { toNumber } from '../../lib/jid.js'
import { bold } from '../../lib/text.js'

export default [
  {
    name: 'ping',
    aliases: ['speed', 'alive'],
    category: 'general',
    description: 'Check that the bot is alive and how fast it replies',
    cooldown: 2,
    async execute(ctx) {
      const started = Date.now()
      const sent = await ctx.reply('👁️ …')
      const latency = Date.now() - started
      await ctx.sock
        .sendMessage(
          ctx.chat,
          { text: `👁️ *Dark Eyes is alive.*\nResponse: *${latency}ms*\nUptime: *${formatDuration(Date.now() - state.startedAt)}*`, edit: sent.key },
          { quoted: ctx.m }
        )
        .catch(() => ctx.reply(`👁️ Alive. Response: *${latency}ms*`))
    }
  },

  {
    name: 'uptime',
    aliases: ['runtime'],
    category: 'general',
    description: 'How long the bot and the session have been running',
    cooldown: 2,
    async execute(ctx) {
      return ctx.reply(
        `⏱️ *Process:* ${formatDuration(Date.now() - state.startedAt)}\n` +
          `📱 *Session:* ${state.connectedAt ? formatDuration(Date.now() - state.connectedAt) : 'not connected'}`
      )
    }
  },

  {
    name: 'stats',
    aliases: ['status', 'botinfo'],
    category: 'general',
    description: 'Live bot statistics',
    cooldown: 3,
    async execute(ctx) {
      return ctx.reply(renderStats({ state, summary: summary() }))
    }
  },

  {
    name: 'info',
    aliases: ['about', 'version'],
    category: 'general',
    description: 'What this bot is, and what it runs on',
    cooldown: 3,
    async execute(ctx) {
      const stats = registryStats()
      return ctx.reply(
        `👁️ *${config.botName}*\n_the eye that sees_\n\n` +
          `*Owner:* ${config.botOwner}\n` +
          `*Mode:* ${config.mode}\n` +
          `*Prefix:* ${config.prefix}\n` +
          `*Commands:* ${stats.commands} (+${stats.aliases} aliases)\n` +
          `*Node:* ${process.version}\n` +
          `*Host:* ${os.type()} ${os.arch()}\n` +
          `*Memory:* ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB\n` +
          `*AI:* ${capabilities.ai ? 'ready' : 'not configured'}\n` +
          `*Downloads:* ${capabilities.downloader ? 'ready' : 'not configured'}\n` +
          `*ffmpeg:* ${capabilities.ffmpeg ? 'available' : 'missing'}`
      )
    }
  },

  {
    name: 'owner',
    aliases: ['creator', 'contact'],
    category: 'general',
    description: 'Reach the human behind the eye',
    cooldown: 5,
    async execute(ctx) {
      if (!config.owners.length) return ctx.reply('No owner number is configured yet.')
      const list = config.owners.map((n) => `wa.me/${n}`).join('\n')
      return ctx.reply(`👑 *Owner:* ${config.botOwner}\n\n${list}\n\n_Messages go straight to the owner._`)
    }
  },

  {
    name: 'time',
    aliases: ['date', 'today'],
    category: 'general',
    description: 'Current time and date in the bot timezone',
    cooldown: 2,
    async execute(ctx) {
      const tz = ctx.args[0] || config.timezone
      try {
        return ctx.reply(
          `🕒 *${formatDate(new Date(), tz)}*\n_Timezone: ${tz}_\n\nUse _${config.prefix}worldtime <country>_ for other zones.`
        )
      } catch {
        return ctx.reply(`Unknown timezone *${tz}*. Try something like Europe/London.`)
      }
    }
  },

  {
    name: 'me',
    aliases: ['whoami', 'profile'],
    category: 'general',
    description: 'Your WhatsApp identity as the bot sees it',
    cooldown: 3,
    async execute(ctx) {
      const user = ctx.db.users.get(ctx.sender)
      const participant = ctx.participants?.find((p) => toNumber(p.id) === toNumber(ctx.sender))
      return ctx.reply(
        `👁️ *That's you:*\n\n` +
          `*Name:* ${ctx.pushName ?? 'unknown'}\n` +
          `*Number:* +${toNumber(ctx.sender)}\n` +
          `*JID:* \`${ctx.sender}\`\n` +
          (ctx.isGroup ? `*Role here:* ${participant?.admin ?? 'member'}\n` : '') +
          `*Commands used:* ${user?.command_count ?? 0}\n` +
          `*Owner:* ${ctx.isOwner ? 'yes' : 'no'}`
      )
    }
  },

  {
    name: 'id',
    aliases: ['myid', 'chatid'],
    category: 'general',
    description: 'The JID of this chat (useful for config)',
    cooldown: 3,
    async execute(ctx) {
      return ctx.reply(`*Chat:* \`${ctx.chat}\`\n*You:* \`${ctx.sender}\``)
    }
  },

  {
    name: 'rules',
    aliases: ['faq'],
    category: 'general',
    description: 'Quick house rules for using the bot',
    cooldown: 5,
    async execute(ctx) {
      return ctx.reply(
        `👁️ *House rules*\n\n` +
          `1. Commands start with *${config.prefix}*.\n` +
          `2. Do not spam a command — cooldowns are enforced.\n` +
          `3. Group admins outrank the bot; I will not override them.\n` +
          `4. Nothing you type is sent anywhere except the APIs a command needs.\n` +
          `5. If a command says ⚠️, it needs a key the owner has not set yet.`
      )
    }
  }
]
