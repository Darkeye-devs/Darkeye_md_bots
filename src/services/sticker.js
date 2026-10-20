import sharp from 'sharp'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { paths } from '../config/index.js'
import { LIMITS } from '../config/constants.js'
import { UserError } from '../lib/errors.js'

const run = promisify(execFile)

/** ffmpeg presence is detected once at boot (see src/index.js). */
export const ffmpegAvailable = async () => {
  try {
    await run('ffmpeg', ['-version'])
    return true
  } catch {
    return false
  }
}

/** Static image → WebP sticker (max 512px, transparent padding to square). */
export async function imageToSticker(buffer, { pack = 'Dark Eyes', author = '👁️' } = {}) {
  const image = sharp(buffer, { failOn: 'none' }).rotate()
  const meta = await image.metadata()

  const side = Math.min(Math.max(meta.width ?? 512, meta.height ?? 512), 512)

  return sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([
      {
        input: await image
          .resize({ width: side, height: side, fit: 'inside', withoutEnlargement: false })
          .webp()
          .toBuffer(),
        gravity: 'center'
      }
    ])
    .webp({ quality: 82, lossless: false, effort: 4 })
    .toBuffer()
}

/** Video (or animated sticker) → animated WebP sticker via ffmpeg. */
export async function videoToSticker(buffer, { duration = 6, fps = 12 } = {}) {
  const tmpIn = path.join(paths.tmp, `stk-${Date.now()}.mp4`)
  const tmpOut = path.join(paths.tmp, `stk-${Date.now()}.webp`)
  await fs.writeFile(tmpIn, buffer)

  try {
    await run('ffmpeg', [
      '-y',
      '-i', tmpIn,
      '-t', String(duration),
      '-vf',
      'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=' + fps,
      '-loop', '0',
      '-ss', '0',
      '-an',
      '-vsync', '0',
      '-s', '512:512',
      '-q:v', '60',
      tmpOut
    ])
    const out = await fs.readFile(tmpOut)
    if (out.length > LIMITS.maxStickerBytes) {
      throw new UserError('That video makes a sticker bigger than WhatsApp allows.', {
        hint: 'Try trimming it under 6 seconds.'
      })
    }
    return out
  } finally {
    await fs.unlink(tmpIn).catch(() => {})
    await fs.unlink(tmpOut).catch(() => {})
  }
}

/** Sticker → PNG / MP4 / GIF depending on what ffmpeg can do. */
export async function stickerToImage(buffer) {
  return sharp(buffer, { failOn: 'none', animated: false }).png().toBuffer()
}

export async function stickerToVideo(buffer) {
  const tmpIn = path.join(paths.tmp, `s2v-${Date.now()}.webp`)
  const tmpOut = path.join(paths.tmp, `s2v-${Date.now()}.mp4`)
  await fs.writeFile(tmpIn, buffer)
  try {
    await run('ffmpeg', [
      '-y', '-i', tmpIn,
      '-movflags', 'faststart',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      tmpOut
    ])
    return await fs.readFile(tmpOut)
  } finally {
    await fs.unlink(tmpIn).catch(() => {})
    await fs.unlink(tmpOut).catch(() => {})
  }
}

/** Apply an image effect through sharp — used by .blur .sepia .invert .grayscale … */
export async function transformImage(buffer, operation, value = 1) {
  let img = sharp(buffer, { failOn: 'none' }).rotate()

  switch (operation) {
    case 'grayscale':
      return img.grayscale().toBuffer()
    case 'sepia': {
      const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
      for (let i = 0; i < data.length; i += 3) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189)
        data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168)
        data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131)
      }
      return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
        .png()
        .toBuffer()
    }
    case 'invert':
      return img.negate({ alpha: false }).toBuffer()
    case 'blur':
      return img.blur(Math.max(0.3, Number(value) || 8)).toBuffer()
    case 'sharpen':
      return img.sharpen().toBuffer()
    case 'mirror':
      return img.flip().toBuffer()
    case 'rotate':
      return img.rotate(Number(value) || 90).toBuffer()
    case 'pixelate': {
      const meta = await img.metadata()
      const size = Number(value) || 12
      const small = await img.resize(Math.max(8, Math.round((meta.width ?? 512) / size))).toBuffer()
      return sharp(small).resize(meta.width, meta.height, { kernel: 'nearest' }).toBuffer()
    }
    case 'brighten':
      return img.modulate({ brightness: 1.3 }).toBuffer()
    case 'darken':
      return img.modulate({ brightness: 0.6 }).toBuffer()
    case 'contrast':
      return img.linear(1.4, -40).toBuffer()
    case 'compress':
      return img.jpeg({ quality: 55 }).toBuffer()
    case 'circle': {
      const size = 512
      const mask = Buffer.from(
        `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
      )
      const resized = await img.resize(size, size, { fit: 'cover' }).toBuffer()
      return sharp(resized).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
    }
    default:
      throw new UserError(`Unknown image operation "${operation}".`)
  }
}

export default {
  imageToSticker,
  videoToSticker,
  stickerToImage,
  stickerToVideo,
  transformImage,
  ffmpegAvailable
}
