import { exportSession } from '../../core/session.js'
import { UserError } from '../../lib/errors.js'

export default [
  {
    name: 'session',
    aliases: ['sessionid', 'getsession'],
    category: 'owner',
    description: 'Get your Session ID for hosting (sent to your DM only)',
    usage: '.session',
    ownerOnly: true,
    cooldown: 15,
    async execute(ctx) {
      const id = await exportSession()

      // Never post a session ID in a group — it is a full account credential.
      if (ctx.isGroup) {
        await ctx.reply('👁️ Session ID sent to your DM — it must never appear in a group.')
      }

      const dm = ctx.sender
      const header =
        `👁️ *DARK EYES — SESSION ID*\n\n` +
        `Paste this into *SESSION_ID* on your host, along with *OWNER_NUMBER*, and the bot boots already paired.\n\n` +
        `⚠️ *This string is your account.* Anyone with it can read your chats. Never share or commit it.\n\n`

      // WhatsApp caps a single message around 65k; a session is usually well under.
      await ctx.sock.sendMessage(dm, { text: header + '```' + id + '```' })
      return { delivered: true }
    }
  }
]
