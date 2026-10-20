import { UserError } from '../../lib/errors.js'
import { config } from '../../config/index.js'
import { truncate } from '../../lib/text.js'

/**
 * Every download command below goes through the configured resolver
 * (DOWNLOAD_API_URL). There is no fake "downloading…" path: if no resolver
 * is configured the capability guard blocks the command before it runs.
 */

const PLATFORM_COMMANDS = {
  youtube: {
    names: ['ytmp4', 'video', 'ytshort'],
    aliases: ['ytvideo', 'yt'],
    type: 'video',
    description: 'Download a YouTube video',
    usage: '.ytmp4 https://youtu.be/…'
  },
  youtube_audio: {
    names: ['ytmp3', 'song', 'play'],
    aliases: ['ytaudio', 'music'],
    type: 'audio',
    description: 'Download the audio of a YouTube video',
    usage: '.ytmp3 https://youtu.be/…'
  },
  tiktok: {
    names: ['tiktok', 'tiktoknowm'],
    aliases: ['tt'],
    type: 'video',
    description: 'Download a TikTok video (no watermark where the resolver supports it)',
    usage: '.tiktok https://vm.tiktok.com/…'
  },
  instagram: {
    names: ['instagram', 'igdl', 'igreel', 'igphoto'],
    aliases: ['ig'],
    type: 'video',
    description: 'Download an Instagram reel, photo or video',
    usage: '.instagram https://instagram.com/p/…'
  },
  facebook: {
    names: ['facebook', 'fbdl', 'fbreel'],
    aliases: ['fb'],
    type: 'video',
    description: 'Download a Facebook video',
    usage: '.facebook https://facebook.com/…'
  },
  twitter: {
    names: ['twitter', 'twdl'],
    aliases: ['x'],
    type: 'video',
    description: 'Download a video or GIF from X/Twitter',
    usage: '.twitter https://x.com/…'
  },
  pinterest: {
    names: ['pinterest', 'pindl'],
    aliases: ['pin'],
    type: 'image',
    description: 'Download a Pinterest image or video',
    usage: '.pinterest https://pinterest.com/pin/…'
  },
  reddit: {
    names: ['reddit'],
    aliases: ['rd'],
    type: 'video',
    description: 'Download media from a Reddit post',
    usage: '.reddit https://reddit.com/r/…'
  },
  spotify: {
    names: ['spotify', 'spotifydl'],
    aliases: ['sp'],
    type: 'audio',
    description: 'Download a Spotify track (resolver dependent — Spotify is DRM-protected)',
    usage: '.spotify https://open.spotify.com/track/…'
  },
  soundcloud: {
    names: ['soundcloud', 'scdl'],
    aliases: ['sc'],
    type: 'audio',
    description: 'Download from SoundCloud',
    usage: '.soundcloud https://soundcloud.com/…'
  },
  threads: {
    names: ['threads'],
    aliases: [],
    type: 'video',
    description: 'Download media from a Threads post',
    usage: '.threads https://threads.net/…'
  }
}

function buildHandler(spec) {
  return async (ctx) => {
    const url = ctx.args[0] ?? ctx.quotedText.match(/https?:\/\/\S+/)?.[0]
    if (!url) throw new UserError('Give me the link.', { hint: `Usage: ${spec.usage}` })

    await ctx.react('⏳')
    const media = await ctx.services.downloader.resolve(url, { type: spec.type })

    if (media.size && media.size > 60 * 1024 * 1024) {
      throw new UserError('That file is too large for WhatsApp (limit is about 60MB).')
    }

    const buffer = await ctx.services.downloader.fetchMedia(media.url)
    const caption = `👁️ *${truncate(media.title, 120)}*\n\n_${media.platform} · ${(buffer.length / 1024 / 1024).toFixed(1)} MB_`

    if (spec.type === 'audio') {
      return ctx.sock.sendMessage(
        ctx.chat,
        { audio: buffer, mimetype: 'audio/mp4', fileName: 'darkeyes.mp3', caption },
        { quoted: ctx.raw }
      )
    }
    if (spec.type === 'image') {
      return ctx.replyMedia(buffer, 'image/jpeg', caption)
    }
    return ctx.replyMedia(buffer, 'video/mp4', caption)
  }
}

const plugins = []

for (const spec of Object.values(PLATFORM_COMMANDS)) {
  for (const name of spec.names) {
    plugins.push({
      name,
      aliases: name === spec.names[0] ? spec.aliases : [],
      category: 'media',
      description: spec.description,
      usage: spec.usage,
      requires: { downloader: true },
      cooldown: 20,
      execute: buildHandler(spec)
    })
  }
}

plugins.push(
  {
    name: 'resolve',
    aliases: ['dl'],
    category: 'media',
    description: 'Inspect a link without downloading it',
    usage: '.resolve <link>',
    requires: { downloader: true },
    cooldown: 10,
    async execute(ctx) {
      const url = ctx.args[0]
      if (!url) throw new UserError('Give me a link.')
      const media = await ctx.services.downloader.resolve(url)
      return ctx.reply(
        `🔍 *${media.platform}* result\n\n*Title:* ${media.title}\n*Type:* ${media.type}\n` +
          (media.duration ? `*Duration:* ${Math.round(media.duration)}s\n` : '') +
          (media.size ? `*Size:* ${(media.size / 1024 / 1024).toFixed(1)} MB\n` : '') +
          `\n_Direct URL hidden for safety._`
      )
    }
  },
  {
    name: 'platforms',
    aliases: ['sites'],
    category: 'media',
    description: 'Which sites this bot can download from',
    cooldown: 5,
    async execute(ctx) {
      const platforms = ctx.services.downloader.supportedPlatforms
      const configured = ctx.services.downloader.enabled
      return ctx.reply(
        `🌐 *Supported platforms* (${platforms.length})\n\n${platforms.join(', ')}\n\n` +
          (configured
            ? `_Resolver configured — downloads are live._`
            : `⚠️ _No resolver configured. Set DOWNLOAD_API_URL in .env to activate them._`)
      )
    }
  }
)

export default plugins
