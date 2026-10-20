import { UserError } from '../../lib/errors.js'

/** Every effect maps to a real sharp operation in services/sticker.js */
const EFFECTS = {
  blur: { op: 'blur', label: 'Blurred', value: 8 },
  sharpen: { op: 'sharpen', label: 'Sharpened' },
  grayscale: { op: 'grayscale', label: 'Black & white' },
  sepia: { op: 'sepia', label: 'Sepia' },
  invert: { op: 'invert', label: 'Inverted' },
  mirror: { op: 'mirror', label: 'Mirrored' },
  brighten: { op: 'brighten', label: 'Brightened' },
  darken: { op: 'darken', label: 'Darkened' },
  contrast: { op: 'contrast', label: 'High contrast' },
  pixelate: { op: 'pixelate', label: 'Pixelated', value: 12 },
  compress: { op: 'compress', label: 'Compressed' },
  circle: { op: 'circle', label: 'Circle crop' },
  rotate: { op: 'rotate', label: 'Rotated', value: 90 }
}

function makeEffect(name) {
  const spec = EFFECTS[name]
  return {
    name,
    category: 'media',
    description: `Apply "${spec.label}" to an image`,
    usage: `.${name} (reply to an image)`,
    cooldown: 5,
    async execute(ctx) {
      const isImage = ctx.media === 'image' || ctx.quotedType === 'image'
      if (!isImage) throw new UserError(`Reply to an image with .${name}.`)

      const buffer = ctx.media === 'image' ? await ctx.download() : await ctx.download({ quoted: true })
      if (!buffer) throw new UserError('Could not read that image.')

      const output = await ctx.services.sticker.transformImage(buffer, spec.op, spec.value)
      return ctx.replyMedia(output, 'image/jpeg', `👁️ ${spec.label}`)
    }
  }
}

export default [
  ...Object.keys(EFFECTS).map(makeEffect),

  {
    name: 'resize',
    category: 'media',
    description: 'Resize an image to exact dimensions',
    usage: '.resize 800x600 (reply to an image)',
    cooldown: 6,
    async execute(ctx) {
      const isImage = ctx.media === 'image' || ctx.quotedType === 'image'
      if (!isImage) throw new UserError('Reply to an image.')

      const match = (ctx.args[0] ?? '').match(/^(\d{1,5})x(\d{1,5})$/i)
      if (!match) throw new UserError('Give me dimensions like 800x600.')

      const [, width, height] = match.map(Number)
      if (width > 4000 || height > 4000) throw new UserError('Keep both sides under 4000px.')

      const buffer = ctx.media === 'image' ? await ctx.download() : await ctx.download({ quoted: true })
      const sharp = (await import('sharp')).default
      const output = await sharp(buffer).resize(width, height, { fit: 'inside' }).jpeg({ quality: 90 }).toBuffer()
      return ctx.replyMedia(output, 'image/jpeg', `👁️ Resized to ${width}×${height}`)
    }
  },

  {
    name: 'watermark',
    category: 'media',
    description: 'Stamp text onto the bottom of an image',
    usage: '.watermark Your text (reply to an image)',
    cooldown: 6,
    async execute(ctx) {
      const isImage = ctx.media === 'image' || ctx.quotedType === 'image'
      if (!isImage) throw new UserError('Reply to an image.')
      const text = ctx.argsText
      if (!text) throw new UserError('Give me the watermark text.')

      const buffer = ctx.media === 'image' ? await ctx.download() : await ctx.download({ quoted: true })
      const sharp = (await import('sharp')).default
      const meta = await sharp(buffer).metadata()
      const width = meta.width ?? 800
      const fontSize = Math.max(18, Math.round(width / 22))
      const safe = String(text).replace(/[<>&'"]/g, '')

      const svg = `<svg width="${width}" height="${fontSize * 2.4}">
        <text x="50%" y="70%" text-anchor="middle" font-family="sans-serif"
          font-size="${fontSize}" fill="#ffffff" opacity="0.72">${safe}</text></svg>`

      const output = await sharp(buffer)
        .composite([{ input: Buffer.from(svg), gravity: 'south' }])
        .jpeg({ quality: 88 })
        .toBuffer()
      return ctx.replyMedia(output, 'image/jpeg', '👁️ Watermarked.')
    }
  },

  {
    name: 'getmedia',
    aliases: ['saveimg', 'savemedia'],
    category: 'media',
    description: 'Re-send media from a view-once or forwarded message as a normal file',
    usage: '.getmedia (reply to media)',
    cooldown: 6,
    async execute(ctx) {
      const buffer = (await ctx.download()) ?? (await ctx.download({ quoted: true }))
      if (!buffer) throw new UserError('Reply to an image, video or document.')

      const type = ctx.media ?? ctx.quotedType
      if (type === 'image') return ctx.replyMedia(buffer, 'image/jpeg', '👁️ Saved.')
      if (type === 'video') return ctx.replyMedia(buffer, 'video/mp4', '👁️ Saved.')
      if (type === 'audio' || type === 'voice') return ctx.replyMedia(buffer, 'audio/mp4', '')
      return ctx.replyMedia(buffer, 'application/octet-stream', '👁️ Saved.', { fileName: `darkeyes-${Date.now()}` })
    }
  }
]
