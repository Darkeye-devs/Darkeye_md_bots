import { config } from '../../config/index.js'
import { resolveTarget } from '../../lib/target.js'
import { toNumber } from '../../lib/jid.js'
import { UserError } from '../../lib/errors.js'
import { bold } from '../../lib/text.js'
import { log } from '../../core/logger.js'

const logger = log('moderation')

const needGroup = (ctx) => {
  if (!ctx.isGroup) throw new UserError('This only works inside a group.')
}

export default [
  {
    name: 'kick',
    aliases: ['remove'],
    category: 'moderation',
    description: 'Remove a member from the group',
    usage: '.kick @user',
    adminOnly: true,
    botAdminOnly: true,
    groupOnly: true,
    cooldown: 2,
    async execute(ctx) {
      needGroup(ctx)
      const target = resolveTarget(ctx)
      if (!target) throw new UserError('Tag the person to remove, or reply to their message.')
      if (target.number === ctx.senderNumber) throw new UserError('You cannot kick yourself.')
      if (config.owners.includes(target.number)) throw new UserError('That number is protected.')

      await ctx.sock.groupParticipantsUpdate(ctx.chat, [target.jid], 'remove')
      return ctx.reply(`👁️ Removed @${target.number}.`, { mentions: [target.jid] })
    }
  },

  {
    name: 'add',
    category: 'moderation',
    description: 'Add a number to the group',
    usage: '.add 2348012345678',
    adminOnly: true,
    botAdminOnly: true,
    groupOnly: true,
    cooldown: 3,
    async execute(ctx) {
      needGroup(ctx)
      const raw = (ctx.args[0] ?? '').replace(/[^0-9]/g, '')
      if (!raw) throw new UserError('Give me a number with the country code.')

      const jid = `${raw}@s.whatsapp.net`
      const [result] = await ctx.sock.groupParticipantsUpdate(ctx.chat, [jid], 'add')
      const status = result?.status ?? 'unknown'

      const messages = {
        200: `👁️ Added @${raw}.`,
        403: `👁️ Could not add @${raw} — their privacy settings block group invites.`,
        408: `👁️ Could not add @${raw} — they left this group recently.`,
        409: `👁️ @${raw} is already in this group.`
      }
      return ctx.reply(messages[status] ?? `👁️ Request finished (status ${status}).`, { mentions: [jid] })
    }
  },

  {
    name: 'promote',
    category: 'moderation',
    description: 'Make a member an admin',
    usage: '.promote @user',
    adminOnly: true,
    botAdminOnly: true,
    groupOnly: true,
    cooldown: 2,
    async execute(ctx) {
      needGroup(ctx)
      const target = resolveTarget(ctx)
      if (!target) throw new UserError('Tag who should become admin.')
      await ctx.sock.groupParticipantsUpdate(ctx.chat, [target.jid], 'promote')
      return ctx.reply(`👑 @${target.number} is now an admin.`, { mentions: [target.jid] })
    }
  },

  {
    name: 'demote',
    category: 'moderation',
    description: 'Remove admin rights from a member',
    usage: '.demote @user',
    adminOnly: true,
    botAdminOnly: true,
    groupOnly: true,
    cooldown: 2,
    async execute(ctx) {
      needGroup(ctx)
      const target = resolveTarget(ctx)
      if (!target) throw new UserError('Tag who should lose admin rights.')
      await ctx.sock.groupParticipantsUpdate(ctx.chat, [target.jid], 'demote')
      return ctx.reply(`👁️ @${target.number} is no longer an admin.`, { mentions: [target.jid] })
    }
  },

  {
    name: 'mute',
    aliases: ['lock', 'close'],
    category: 'moderation',
    description: 'Only admins can talk in this group',
    adminOnly: true,
    botAdminOnly: true,
    groupOnly: true,
    cooldown: 3,
    async execute(ctx) {
      needGroup(ctx)
      await ctx.sock.groupSettingUpdate(ctx.chat, 'announcement')
      ctx.db.groups.set(ctx.chat, 'mute', 0) // group-level mute handled by WhatsApp itself
      return ctx.reply('🔒 Group locked — only admins can send messages.')
    }
  },

  {
    name: 'unmute',
    aliases: ['unlock', 'open'],
    category: 'moderation',
    description: 'Let everyone talk again',
    adminOnly: true,
    botAdminOnly: true,
    groupOnly: true,
    cooldown: 3,
    async execute(ctx) {
      needGroup(ctx)
      await ctx.sock.groupSettingUpdate(ctx.chat, 'not_announcement')
      return ctx.reply('🔓 Group unlocked — everyone can send messages.')
    }
  },

  {
    name: 'tagall',
    aliases: ['everyone'],
    category: 'moderation',
    description: 'Mention every member (admins only, by default)',
    usage: '.tagall [message]',
    adminOnly: true,
    groupOnly: true,
    cooldown: 30,
    async execute(ctx) {
      needGroup(ctx)
      const note = ctx.argsText || '👁️ Attention, everyone.'
      const meta = await ctx.groupMeta()
      if (!meta) throw new UserError('Could not read the member list.')
      const jids = meta.participants.map((p) => p.id)
      return ctx.say({
        text: `${note}\n\n${jids.map((j) => `@${toNumber(j)}`).join(' ')}`,
        mentions: jids
      })
    }
  },

  {
    name: 'hidetag',
    category: 'moderation',
    description: 'Mention everyone without showing the tags',
    usage: '.hidetag message',
    adminOnly: true,
    groupOnly: true,
    cooldown: 15,
    async execute(ctx) {
      needGroup(ctx)
      const note = ctx.argsText
      if (!note) throw new UserError('What should I say?')
      const meta = await ctx.groupMeta()
      return ctx.say({ text: note, mentions: meta.participants.map((p) => p.id) })
    }
  },

  {
    name: 'tagadmins',
    category: 'moderation',
    description: 'Mention only the group admins',
    groupOnly: true,
    cooldown: 15,
    async execute(ctx) {
      needGroup(ctx)
      const meta = await ctx.groupMeta()
      const admins = meta.participants.filter((p) => p.admin).map((p) => p.id)
      if (!admins.length) throw new UserError('This group has no admins.')
      return ctx.say({
        text: `${ctx.argsText || '👁️ Admins, your attention.'}\n\n${admins.map((j) => `@${toNumber(j)}`).join(' ')}`,
        mentions: admins
      })
    }
  },

  {
    name: 'groupinfo',
    aliases: ['ginfo'],
    category: 'moderation',
    description: 'Everything about this group',
    groupOnly: true,
    cooldown: 5,
    async execute(ctx) {
      needGroup(ctx)
      const meta = await ctx.groupMeta()
      if (!meta) throw new UserError('Could not read group metadata.')
      const admins = meta.participants.filter((p) => p.admin).length
      const settings = ctx.db.groups.settings(ctx.chat)
      const created = meta.creation ? new Date(meta.creation * 1000).toDateString() : 'unknown'
      return ctx.reply(
        `👁️ ${bold(meta.subject)}\n\n` +
          `*ID:* \`${meta.id}\`\n` +
          `*Members:* ${meta.participants.length} (${admins} admins)\n` +
          `*Created:* ${created}\n` +
          `*Owner:* ${meta.owner ? `@${toNumber(meta.owner)}` : 'unknown'}\n` +
          `*Description:* ${meta.desc || '_none_'}\n\n` +
          `*Guards:* antilink ${settings.antilink} · antispam ${settings.antispam ? 'on' : 'off'} · ` +
          `welcome ${settings.welcome ? 'on' : 'off'} · goodbye ${settings.goodbye ? 'on' : 'off'}`
      )
    }
  },

  {
    name: 'grouplink',
    aliases: ['linkgroup'],
    category: 'moderation',
    description: 'Get (or create) the invite link',
    adminOnly: true,
    botAdminOnly: true,
    groupOnly: true,
    cooldown: 10,
    async execute(ctx) {
      needGroup(ctx)
      const code = await ctx.sock.groupInviteCode(ctx.chat)
      return ctx.reply(`🔗 https://chat.whatsapp.com/${code}`)
    }
  },

  {
    name: 'revoke',
    aliases: ['resetlink'],
    category: 'moderation',
    description: 'Reset the invite link so old links stop working',
    adminOnly: true,
    botAdminOnly: true,
    groupOnly: true,
    cooldown: 10,
    async execute(ctx) {
      needGroup(ctx)
      await ctx.sock.groupRevokeInvite(ctx.chat)
      const code = await ctx.sock.groupInviteCode(ctx.chat)
      return ctx.reply(`👁️ Old link revoked.\n\n🔗 https://chat.whatsapp.com/${code}`)
    }
  },

  {
    name: 'setname',
    category: 'moderation',
    description: 'Rename this group',
    usage: '.setname New name',
    adminOnly: true,
    botAdminOnly: true,
    groupOnly: true,
    cooldown: 10,
    async execute(ctx) {
      needGroup(ctx)
      if (!ctx.argsText) throw new UserError('Give me the new name.')
      await ctx.sock.groupUpdateSubject(ctx.chat, ctx.argsText)
      return ctx.reply(`👁️ Renamed to *${ctx.argsText}*.`)
    }
  },

  {
    name: 'setdesc',
    category: 'moderation',
    description: 'Change the group description',
    usage: '.setdesc New description',
    adminOnly: true,
    botAdminOnly: true,
    groupOnly: true,
    cooldown: 10,
    async execute(ctx) {
      needGroup(ctx)
      if (!ctx.argsText) throw new UserError('Give me the new description.')
      await ctx.sock.groupUpdateDescription(ctx.chat, ctx.argsText)
      return ctx.reply('👁️ Description updated.')
    }
  },

  {
    name: 'setpp',
    category: 'moderation',
    description: 'Set the group photo from an image you reply to',
    usage: '.setpp (reply to an image)',
    adminOnly: true,
    botAdminOnly: true,
    groupOnly: true,
    cooldown: 15,
    async execute(ctx) {
      needGroup(ctx)
      const buffer = ctx.media === 'image' ? await ctx.download() : ctx.quotedType === 'image' ? await ctx.download({ quoted: true }) : null
      if (!buffer) throw new UserError('Reply to an image and I will use it as the group photo.')
      await ctx.sock.updateProfilePicture(ctx.chat, buffer)
      return ctx.reply('👁️ Group photo updated.')
    }
  },

  {
    name: 'delpp',
    aliases: ['removepp'],
    category: 'moderation',
    description: 'Remove the group photo',
    adminOnly: true,
    botAdminOnly: true,
    groupOnly: true,
    cooldown: 15,
    async execute(ctx) {
      needGroup(ctx)
      await ctx.sock.removeProfilePicture(ctx.chat)
      return ctx.reply('👁️ Group photo removed.')
    }
  },

  {
    name: 'poll',
    category: 'moderation',
    description: 'Create a real WhatsApp poll',
    usage: '.poll Question | option1 | option2',
    groupOnly: true,
    cooldown: 10,
    async execute(ctx) {
      const parts = ctx.argsText.split('|').map((s) => s.trim()).filter(Boolean)
      if (parts.length < 3) {
        throw new UserError('Format: .poll Question | option 1 | option 2', {
          hint: 'At least two options are needed.'
        })
      }
      const [question, ...options] = parts
      return ctx.sock.sendMessage(ctx.chat, {
        poll: { name: question, values: options.slice(0, 12), selectableCount: 1 }
      })
    }
  },

  {
    name: 'announce',
    category: 'moderation',
    description: 'Send a formatted announcement',
    usage: '.announce Your message',
    adminOnly: true,
    groupOnly: true,
    cooldown: 10,
    async execute(ctx) {
      if (!ctx.argsText) throw new UserError('What should I announce?')
      return ctx.say(`📣 *ANNOUNCEMENT*\n\n${ctx.argsText}\n\n_— ${config.botName}_`)
    }
  },

  {
    name: 'delete',
    aliases: ['del'],
    category: 'moderation',
    description: 'Delete the message you replied to',
    usage: '.delete (reply to a message)',
    adminOnly: true,
    botAdminOnly: true,
    groupOnly: true,
    cooldown: 2,
    async execute(ctx) {
      if (!ctx.quoted) throw new UserError('Reply to the message you want deleted.')
      await ctx.sock.sendMessage(ctx.chat, { delete: ctx.quoted.key })
      await ctx.sock.sendMessage(ctx.chat, { delete: ctx.m.key }).catch(() => {})
    }
  }
]
