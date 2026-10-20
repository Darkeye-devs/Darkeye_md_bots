import { UserError } from '../../lib/errors.js'
import { log } from '../../core/logger.js'

const logger = log('sticker')

/** Sorted media source: the message itself first, then what it replies to. */
async function getSource(ctx) {
  if (ctx.media) return { buffer: await ctx.download(), type: ctx.media }
  if (ctx.quotedType) return { buffer: await ctx.download({ quoted: true }), type: ctx.quotedType }
  return { buffer: null, type: null }
}

export default [
  {
    name: 'sticker',
    aliases: ['s', 'stiker'],
    category: 'media',
    description: 'Turn an image, video or GIF into a WhatsApp sticker',
    usage: '.sticker (reply to media, or send with a caption)',
    cooldown: 4,
    async execute(ctx) {
      const { buffer, type } = await getSource(ctx)
      if (!buffer) {
        throw new UserError('Reply to an image, video or sticker with .sticker.', {
          hint: 'Stickers must be under 1MB and videos under 6 seconds.'
        })
      }

      if (type === 'image') {
        const webp = await ctx.services.sticker.imageToSticker(buffer)
        return ctx.sock.sendMessage(ctx.chat, { sticker: webp }, { quoted: ctx.raw })
      }

      if (type === 'video') {
        if (!ctx.services.capabilities.ffmpeg) {
          throw new UserError('Video stickers need ffmpeg on the host.', {
            hint: 'Install ffmpeg, or send a still image instead.'
          })
        }
        const webp = await ctx.services.sticker.videoToSticker(buffer)
        return ctx.sock.sendMessage(ctx.chat, { sticker: webp }, { quoted: ctx.raw })
      }

      if (type === 'sticker') {
        return ctx.reply('👁️ That is already a sticker.')
      }

      throw new UserError(`I cannot make a sticker out of a ${type ?? 'message'} yet.`)
    }
  },

  {
    name: 'toimg',
    aliases: ['stickertoimg', 'topng'],
    category: 'media',
    description: 'Convert a sticker back into an image',
    usage: '.toimg (reply to a sticker)',
    cooldown: 4,
    async execute(ctx) {
      const { buffer, type } = await getSource(ctx)
      if (!buffer) throw new UserError('Reply to a sticker.')
      if (type !== 'sticker') throw new UserError('That is not a sticker — reply to a sticker message.')

      const png = await ctx.services.sticker.stickerToImage(buffer)
      return ctx.replyMedia(png, 'image/png', '👁️ Sticker converted.')
    }
  },

  {
    name: 'tovideo',
    aliases: ['sticker2video', 'tomp4'],
    category: 'media',
    description: 'Convert an animated sticker into an MP4',
    usage: '.tovideo (reply to a sticker)',
    requires: { ffmpeg: true },
    cooldown: 8,
    async execute(ctx) {
      const { buffer, type } = await getSource(ctx)
      if (!buffer || type !== 'sticker') throw new UserError('Reply to an animated sticker.')
      const mp4 = await ctx.services.sticker.stickerToVideo(buffer)
      return ctx.replyMedia(mp4, 'video/mp4', '👁️ Sticker converted to video.')
    }
  },

  {
    name: 'take',
    aliases: ['wm', 'stickerpack'],
    category: 'media',
    description: 'Re-send a sticker with your own pack name and author',
    usage: '.take Pack Name | Author',
    cooldown: 5,
    async execute(ctx) {
      const { buffer, type } = await getSource(ctx)
      if (!buffer || type !== 'sticker') throw new UserError('Reply to a sticker.')

      const [pack, author] = ctx.argsText ? ctx.argsText.split('|').map((s) => s.trim()) : [null, null]
      return ctx.sock.sendMessage(
        ctx.chat,
        {
          sticker: buffer,
          // Baileys accepts these metadata fields on sticker sends
          ...(pack ? { stickerPackName: pack, stickerPackPublisher: author ?? '👁️ Dark Eyes' } : {})
        },
        { quoted: ctx.raw }
      )
    }
  },

  {
    name: 'vv',
    aliases: ['viewonce', 'reveal'],
    category: 'media',
    description: 'Reveal a view-once photo or video (in this chat only)',
    usage: '.vv (reply to a view-once message)',
    cooldown: 5,
    async execute(ctx) {
      const quoted = ctx.quoted
      if (!quoted) throw new UserError('Reply to a view-once message.')

      const buffer = await ctx.download({ quoted: true })
      if (!buffer) throw new UserError('Could not open that media.')

      const isVideo = quoted.message?.videoMessage || quoted.message?.viewOnceMessageV2?.message?.videoMessage
      return ctx.sock.sendMessage(
        ctx.chat,
        isVideo ? { video: buffer, caption: '👁️ View-once revealed.' } : { image: buffer, caption: '👁️ View-once revealed.' },
        { quoted: ctx.raw }
      )
    }
  },

  {
    name: 'getpp',
    aliases: ['pp', 'avatar'],
    category: 'media',
    description: 'Get the profile picture of a contact',
    usage: '.getpp @user',
    cooldown: 4,
    async execute(ctx) {
      const target = ctx.mentions[0] ?? ctx.quoted?.key?.participant ?? ctx.sender
      let url = null
      try {
        url = await ctx.sock.profilePictureUrl(target, 'image')
      } catch {
        throw new UserError('No profile picture available (or it is hidden by privacy settings).')
      }
      const res = await fetch(url)
      const buffer = Buffer.from(await res.arrayBuffer())
      return ctx.replyMedia(buffer, 'image/jpeg', `👁️ Profile picture of @${target.split('@')[0]}`, {
        mentions: [target]
      })
    }
  },

  {
    name: 'getbio',
    aliases: ['aboutuser', 'bio'],
    category: 'media',
    description: 'Read the About/bio of a contact',
    usage: '.getbio @user',
    cooldown: 4,
    async execute(ctx) {
      const target = ctx.mentions[0] ?? ctx.quoted?.key?.participant ?? ctx.sender
      const [result] = await ctx.sock.fetchStatus(target)
      if (!result?.status) throw new UserError('That contact has no visible bio.')
      return ctx.reply(`👁️ *Bio of @${target.split('@')[0]}:*\n\n${result.status}`, { mentions: [target] })
    }
  }
]
