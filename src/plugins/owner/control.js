import fs from 'node:fs'
import path from 'node:path'
import { config } from '../../config/index.js'
import { loadPlugins, registryStats } from '../../core/registry.js'
import { state } from '../../core/state.js'
import { backupDatabase } from '../../services/scheduler.js'
import { formatDuration } from '../../lib/time.js'
import { UserError } from '../../lib/errors.js'
import { bold } from '../../lib/text.js'
import { db } from '../../services/index.js'

export default [
  {
    name: 'mode',
    aliases: ['self', 'public', 'private'],
    category: 'owner',
    description: 'Switch between public mode and owner-only mode',
    usage: '.mode public|self',
    ownerOnly: true,
    cooldown: 2,
    async execute(ctx) {
      const requested = ctx.command === 'mode' ? ctx.args[0]?.toLowerCase() : ctx.command
      if (!requested) {
        return ctx.reply(`👁️ Current mode: *${config.mode}*\n\n_${config.mode === 'self' ? 'Only you can use commands.' : 'Everyone can use commands.'}_`)
      }
      if (!['public', 'self'].includes(requested)) throw new UserError('Use *public* or *self*.')
      config.mode = requested
      db.settings.set('mode', requested)
      return ctx.reply(`👁️ Bot mode is now *${requested}*.`)
    }
  },

  {
    name: 'broadcast',
    aliases: ['bc'],
    category: 'owner',
    description: 'Send a message to every chat the bot knows',
    usage: '.broadcast Your announcement',
    ownerOnly: true,
    cooldown: 30,
    async execute(ctx) {
      if (!ctx.argsText) throw new UserError('What should I broadcast?')
      const chats = db.getDb().prepare('SELECT jid FROM chats').all()
      await ctx.react('📣')

      let sent = 0
      let failed = 0
      for (const { jid } of chats) {
        try {
          await ctx.sock.sendMessage(jid, { text: `📣 *${config.botName}*\n\n${ctx.argsText}` })
          sent++
          await new Promise((r) => setTimeout(r, 400)) // gentle pacing
        } catch {
          failed++
        }
      }
      return ctx.reply(`📣 Broadcast finished.\n*Sent:* ${sent}\n*Failed:* ${failed}`)
    }
  },

  {
    name: 'backup',
    category: 'owner',
    description: 'Back the database up right now',
    ownerOnly: true,
    cooldown: 30,
    async execute(ctx) {
      backupDatabase()
      const files = fs.readdirSync(config.backupDir).filter((f) => f.endsWith('.db')).sort().reverse()
      const latest = files[0]
      const size = latest ? Math.round(fs.statSync(path.join(config.backupDir, latest)).size / 1024) : 0
      return ctx.reply(`💾 Backup written: \`${latest ?? 'none'}\` (${size} KB)\n_Kept: ${files.length} most recent_`)
    }
  },

  {
    name: 'reload',
    category: 'owner',
    description: 'Reload every plugin without restarting the process',
    ownerOnly: true,
    cooldown: 10,
    async execute(ctx) {
      const before = registryStats()
      await loadPlugins({ silent: true })
      const after = registryStats()
      return ctx.reply(
        `♻️ Plugins reloaded.\n\n*Commands:* ${before.commands} → ${after.commands}\n` +
          `*Aliases:* ${before.aliases} → ${after.aliases}\n*Failed:* ${after.failed}` +
          (after.failed ? `\n\n_Check the logs for details._` : '')
      )
    }
  },

  {
    name: 'restart',
    aliases: ['reboot'],
    category: 'owner',
    description: 'Restart the process (pm2/docker will bring it back)',
    ownerOnly: true,
    cooldown: 0,
    async execute(ctx) {
      await ctx.reply('👁️ Restarting…')
      setTimeout(() => process.exit(0), 500)
    }
  },

  {
    name: 'block',
    category: 'owner',
    description: 'Block a contact',
    usage: '.block 2348012345678',
    ownerOnly: true,
    cooldown: 3,
    async execute(ctx) {
      const number = (ctx.args[0] ?? '').replace(/[^0-9]/g, '')
      if (!number) throw new UserError('Give me a number to block.')
      await ctx.sock.updateBlockStatus(`${number}@s.whatsapp.net`, 'block')
      return ctx.reply(`🚫 Blocked ${number}.`)
    }
  },

  {
    name: 'unblock',
    category: 'owner',
    description: 'Unblock a contact',
    usage: '.unblock 2348012345678',
    ownerOnly: true,
    cooldown: 3,
    async execute(ctx) {
      const number = (ctx.args[0] ?? '').replace(/[^0-9]/g, '')
      if (!number) throw new UserError('Give me a number to unblock.')
      await ctx.sock.updateBlockStatus(`${number}@s.whatsapp.net`, 'unblock')
      return ctx.reply(`✅ Unblocked ${number}.`)
    }
  },

  {
    name: 'blocklist',
    category: 'owner',
    description: 'See who is blocked',
    ownerOnly: true,
    cooldown: 5,
    async execute(ctx) {
      const list = await ctx.sock.fetchBlocklist()
      if (!list?.length) return ctx.reply('Nobody is blocked.')
      return ctx.reply(`🚫 *Blocked (${list.length})*\n\n${list.map((j) => `• ${j.split('@')[0]}`).join('\n')}`)
    }
  },

  {
    name: 'setbotname',
    category: 'owner',
    description: 'Change the name used in menus',
    usage: '.setbotname New Name',
    ownerOnly: true,
    cooldown: 3,
    async execute(ctx) {
      if (!ctx.argsText) throw new UserError('Give me the new name.')
      config.botName = ctx.argsText.slice(0, 40)
      db.settings.set('botName', config.botName)
      return ctx.reply(`👁️ I am now *${config.botName}*.`)
    }
  },

  {
    name: 'setbotstatus',
    aliases: ['setbio'],
    category: 'owner',
    description: 'Set the WhatsApp profile status of the bot number',
    usage: '.setbotstatus text',
    ownerOnly: true,
    cooldown: 10,
    async execute(ctx) {
      const text = ctx.argsText || `${config.botName} — the eye that sees`
      await ctx.sock.updateProfileStatus(text)
      return ctx.reply('👁️ Profile status updated.')
    }
  },

  {
    name: 'setbotpp',
    category: 'owner',
    description: 'Set the bot profile picture from an image',
    usage: '.setbotpp (reply to an image)',
    ownerOnly: true,
    cooldown: 15,
    async execute(ctx) {
      const buffer = ctx.media === 'image' ? await ctx.download() : ctx.quotedType === 'image' ? await ctx.download({ quoted: true }) : null
      if (!buffer) throw new UserError('Reply to an image.')
      await ctx.sock.updateProfilePicture(ctx.sock.user.id, buffer)
      return ctx.reply('👁️ Profile picture updated.')
    }
  },

  {
    name: 'delbotpp',
    category: 'owner',
    description: 'Remove the bot profile picture',
    ownerOnly: true,
    cooldown: 15,
    async execute(ctx) {
      await ctx.sock.removeProfilePicture(ctx.sock.user.id)
      return ctx.reply('👁️ Profile picture removed.')
    }
  },

  {
    name: 'joingroup',
    aliases: ['join'],
    category: 'owner',
    description: 'Join a group from an invite link',
    usage: '.join https://chat.whatsapp.com/XXXX',
    ownerOnly: true,
    cooldown: 10,
    async execute(ctx) {
      const link = ctx.args[0]
      if (!link?.includes('chat.whatsapp.com')) throw new UserError('Give me a valid invite link.')
      const code = link.split('/').pop()
      const jid = await ctx.sock.groupAcceptInvite(code)
      return ctx.reply(`👁️ Joined ${jid}.`)
    }
  },

  {
    name: 'leavegroup',
    aliases: ['leave'],
    category: 'owner',
    description: 'Leave this group',
    ownerOnly: true,
    groupOnly: true,
    cooldown: 10,
    async execute(ctx) {
      await ctx.reply('👁️ Leaving this group. Goodbye.')
      await ctx.sock.groupLeave(ctx.chat)
    }
  },

  {
    name: 'shell',
    aliases: ['exec'],
    category: 'owner',
    description: 'Run a shell command on the host (owner only)',
    usage: '.shell ls -la',
    ownerOnly: true,
    cooldown: 0,
    hidden: true,
    async execute(ctx) {
      const cmd = ctx.argsText
      if (!cmd) throw new UserError('Give me a command.')
      const { exec } = await import('node:child_process')
      const output = await new Promise((resolve) => {
        exec(cmd, { timeout: 20_000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
          resolve(error ? `ERROR: ${stderr || error.message}` : stdout || '(no output)')
        })
      })
      return ctx.reply(`💻 \`\`\`${String(output).slice(0, 3500)}\`\`\``)
    }
  },

  {
    name: 'eval',
    category: 'owner',
    description: 'Evaluate JavaScript on the host (owner only)',
    usage: '.eval 2 + 2',
    ownerOnly: true,
    cooldown: 0,
    hidden: true,
    async execute(ctx) {
      const code = ctx.argsText
      if (!code) throw new UserError('Give me an expression.')
      try {
        // eslint-disable-next-line no-eval
        const result = await eval(`(async () => { ${code.includes('return') ? code : `return ${code}`} })()`)
        return ctx.reply(`💻 \`\`\`${JSON.stringify(result, null, 2)?.slice(0, 3500) ?? String(result)}\`\`\``)
      } catch (error) {
        return ctx.reply(`⚠️ \`\`\`${error.message}\`\`\``)
      }
    }
  },

  {
    name: 'cleartmp',
    category: 'owner',
    description: 'Delete cached temp files',
    ownerOnly: true,
    cooldown: 10,
    async execute(ctx) {
      const dir = path.join(config.rootDir, 'data', 'tmp')
      let removed = 0
      try {
        for (const file of fs.readdirSync(dir)) {
          fs.unlinkSync(path.join(dir, file))
          removed++
        }
      } catch {
        /* nothing to clean */
      }
      return ctx.reply(`🧹 Removed ${removed} temp file(s).`)
    }
  },

  {
    name: 'logs',
    category: 'owner',
    description: 'Show recent activity summary',
    ownerOnly: true,
    cooldown: 10,
    async execute(ctx) {
      const top = db.stats.commands(8)
      return ctx.reply(
        `${bold('RECENT ACTIVITY')}\n\n*Uptime:* ${formatDuration(Date.now() - state.startedAt)}\n` +
          `*Messages:* ${state.messagesHandled}\n*Commands:* ${state.commandsHandled}\n\n` +
          `*Top commands:*\n${top.map((c, i) => `${i + 1}. ${c.command} — ${c.count}`).join('\n') || '_none yet_'}`
      )
    }
  }
]
