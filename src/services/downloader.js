import { config } from '../config/index.js'
import { fetchJson } from '../lib/http.js'
import { UserError } from '../lib/errors.js'

/**
 * Downloader service.
 *
 * Honest design note: scraping YouTube/TikTok/Instagram from a server needs a
 * resolver (a yt-dlp worker or a third-party API). Nothing here pretends to
 * download if no resolver is configured — it says so and tells you what to set.
 *
 * Set DOWNLOAD_API_URL to any service that accepts `?url=<link>` and returns:
 *   { "title": "...", "url": "<direct media url>", "thumbnail": "...", "type": "video|audio|image" }
 */

export const enabled = Boolean(config.downloader.apiUrl)

const SUPPORTED = {
  youtube: /(?:youtube\.com|youtu\.be)/i,
  tiktok: /tiktok\.com|vm\.tiktok/i,
  instagram: /instagram\.com|instagr\.am/i,
  facebook: /facebook\.com|fb\.watch/i,
  twitter: /twitter\.com|x\.com/i,
  pinterest: /pinterest\./i,
  reddit: /reddit\.com|redd\.it/i,
  spotify: /spotify\.com/i,
  soundcloud: /soundcloud\.com/i,
  threads: /threads\.net/i,
  snapchat: /snapchat\.com/i,
  vimeo: /vimeo\.com/i,
  twitch: /twitch\.tv/i
}

/** Which platform does this link belong to? */
export function detectPlatform(url = '') {
  for (const [name, pattern] of Object.entries(SUPPORTED)) {
    if (pattern.test(url)) return name
  }
  return null
}

export const supportedPlatforms = Object.keys(SUPPORTED)

function assertEnabled(platform) {
  if (!enabled) {
    throw new UserError(`${platform ? `${platform} downloads` : 'Downloads'} need a resolver API.`, {
      hint: 'Set DOWNLOAD_API_URL in .env — see docs/DEPLOY.md for a free self-hosted option.'
    })
  }
}

/**
 * Resolve a link to a direct media URL.
 * @returns {Promise<{title,url,thumbnail,type,platform}>}
 */
export async function resolve(url, { type = 'video', quality = 'high' } = {}) {
  const platform = detectPlatform(url)
  if (!platform) {
    throw new UserError('That link is not from a platform I recognise.', {
      hint: `Supported: ${supportedPlatforms.join(', ')}`
    })
  }
  assertEnabled(platform)

  const endpoint = new URL(config.downloader.apiUrl)
  endpoint.searchParams.set('url', url)
  endpoint.searchParams.set('type', type)
  endpoint.searchParams.set('quality', quality)

  const data = await fetchJson(endpoint.toString(), {
    headers: config.downloader.apiKey ? { authorization: `Bearer ${config.downloader.apiKey}` } : {},
    timeout: 60_000
  })

  const direct = data?.url ?? data?.download ?? data?.data?.url
  if (!direct) throw new UserError('The resolver could not find media on that link.')

  return {
    platform,
    title: data?.title ?? data?.data?.title ?? 'Untitled',
    url: direct,
    thumbnail: data?.thumbnail ?? data?.data?.thumbnail ?? null,
    type: data?.type ?? type,
    size: data?.size ?? null,
    duration: data?.duration ?? null
  }
}

/** Stream a direct media URL into a Buffer (with a size guard). */
export async function fetchMedia(url, { maxBytes = 64 * 1024 * 1024 } = {}) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; DarkEyesBot)' } })
  if (!res.ok) throw new UserError(`Download failed (HTTP ${res.status}).`)

  const length = Number(res.headers.get('content-length') ?? 0)
  if (length && length > maxBytes) {
    throw new UserError('That file is too large to send through WhatsApp.')
  }

  return Buffer.from(await res.arrayBuffer())
}

export default { resolve, fetchMedia, detectPlatform, supportedPlatforms, enabled }
