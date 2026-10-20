import { UserError } from '../../lib/errors.js'
import { fetchJson } from '../../lib/http.js'

/**
 * Anime / manga catalogue — every answer comes from AniList's public GraphQL API
 * (no key). Reaction images come from nekos.best, which is also keyless.
 *
 * AniList entries open by id in the URL after the title, so the bot can deep
 * link instead of pasting walls of text.
 */

const TRIM = (text, max = 700) => {
  const clean = String(text || '').trim()
  if (!clean) return ''
  return clean.length <= max ? clean : `${clean.slice(0, max).trimEnd()}…`
}

function mediaCard(m, kind = 'ANIME') {
  const lines = [`🎬 *${m.title}*`]
  if (m.nativeTitle && m.nativeTitle !== m.title) lines.push(`_${m.nativeTitle}_`)

  const facts = [
    m.format,
    m.status,
    m.year ? `${m.season ? `${m.season.toLowerCase()} ` : ''}${m.year}` : null,
    kind === 'ANIME' ? (m.episodes ? `${m.episodes} eps` : m.duration ? `${m.duration} min` : null) : null,
    kind === 'MANGA' ? (m.chapters ? `${m.chapters} ch` : null) : null,
    kind === 'MANGA' ? (m.volumes ? `${m.volumes} vols` : null) : null
  ].filter(Boolean)
  if (facts.length) lines.push(`📺 ${facts.join(' · ')}`)

  if (m.studios?.length) lines.push(`🏢 ${m.studios.join(', ')}`)
  if (m.genres?.length) lines.push(`🏷️ ${m.genres.slice(0, 5).join(', ')}`)
  if (m.score) lines.push(`⭐ ${m.score}% average · ❤️ ${m.favourites ?? 0} favourites`)
  if (m.description) lines.push(`\n${TRIM(m.description)}`)
  if (m.url) lines.push(`\n🔗 ${m.url}`)
  return lines.join('\n')
}

async function nekosImage(kind, endpoint) {
  const data = await fetchJson(`https://nekos.best/api/v2/${endpoint}`, { timeout: 8000, retries: 1 })
  const first = data?.results?.[0]
  if (!first?.url) throw new UserError('The image API returned nothing. Try again.')
  return { url: first.url, artist: first.artist_name ?? null, source: first.source_url ?? null, kind }
}

export default [
  {
    name: 'anime',
    aliases: ['animesearch', 'anilist', 'mal', 'myanimelist'],
    category: 'anime',
    description: 'Search anime on AniList',
    usage: '.anime attack on titan',
    cooldown: 3,
    async execute(ctx) {
      const term = ctx.argsText?.trim()
      if (!term) throw new UserError('Give me a title: .anime attack on titan')

      const results = await ctx.services.anilist.searchAnime(term, { limit: 5 })
      if (!results.length) throw new UserError(`No anime found for "${term}".`)

      if (results.length === 1) return ctx.reply(mediaCard(results[0]))

      const list = results
        .map((m, i) => `${i + 1}. *${m.title}*${m.year ? ` (${m.year})` : ''}${m.score ? ` — ${m.score}%` : ''}`)
        .join('\n')
      return ctx.reply(
        `🔎 *Results for "${term}"*\n\n${list}\n\n_Use .animeinfo <number or title> for the full card, or .anime <exact title>._`
      )
    }
  },

  {
    name: 'animeinfo',
    aliases: ['animeid'],
    category: 'anime',
    description: 'Full details for one anime (title or AniList id)',
    usage: '.animeinfo 16498',
    cooldown: 3,
    async execute(ctx) {
      const input = ctx.argsText?.trim()
      if (!input) throw new UserError('Give me a title or an AniList id.')

      if (/^\d+$/.test(input)) {
        const media = await ctx.services.anilist.animeById(input)
        if (!media) throw new UserError(`No anime with id ${input}.`)
        return ctx.reply(mediaCard(media))
      }

      const [first] = await ctx.services.anilist.searchAnime(input, { limit: 1 })
      if (!first) throw new UserError(`No anime found for "${input}".`)
      return ctx.reply(mediaCard(first))
    }
  },

  {
    name: 'manga',
    aliases: ['mangasearch', 'manhwa', 'manhua'],
    category: 'anime',
    description: 'Search manga / manhwa / manhua on AniList',
    usage: '.manga berserk',
    cooldown: 3,
    async execute(ctx) {
      const term = ctx.argsText?.trim()
      if (!term) throw new UserError('Give me a title: .manga berserk')

      const results = await ctx.services.anilist.searchManga(term, { limit: 5 })
      if (!results.length) throw new UserError(`No manga found for "${term}".`)

      if (results.length === 1) return ctx.reply(mediaCard(results[0], 'MANGA'))

      const list = results
        .map((m, i) => `${i + 1}. *${m.title}*${m.year ? ` (${m.year})` : ''}${m.chapters ? ` — ${m.chapters} ch` : ''}`)
        .join('\n')
      return ctx.reply(`📚 *Manga results for "${term}"*\n\n${list}\n\n_Use .mangainfo <title> for the full card._`)
    }
  },

  {
    name: 'mangainfo',
    category: 'anime',
    description: 'Full details for one manga (title or AniList id)',
    usage: '.mangainfo berserk',
    cooldown: 3,
    async execute(ctx) {
      const input = ctx.argsText?.trim()
      if (!input) throw new UserError('Give me a title or an AniList id.')

      if (/^\d+$/.test(input)) {
        const media = await ctx.services.anilist.mangaById(input)
        if (!media) throw new UserError(`No manga with id ${input}.`)
        return ctx.reply(mediaCard(media, 'MANGA'))
      }

      const [first] = await ctx.services.anilist.searchManga(input, { limit: 1 })
      if (!first) throw new UserError(`No manga found for "${input}".`)
      return ctx.reply(mediaCard(first, 'MANGA'))
    }
  },

  {
    name: 'trendinganime',
    aliases: ['animetrending', 'airing'],
    category: 'anime',
    description: 'What is trending on AniList right now',
    cooldown: 5,
    async execute(ctx) {
      const list = await ctx.services.anilist.trending({ limit: 8 })
      if (!list.length) throw new UserError('AniList returned no trending titles.')

      const body = list
        .map((m, i) => `${i + 1}. *${m.title}*${m.score ? ` — ${m.score}%` : ''}${m.nextEpisode ? ` · ep ${m.nextEpisode} soon` : ''}`)
        .join('\n')
      return ctx.reply(`🔥 *Trending on AniList*\n\n${body}\n\n_Source: anilist.co_`)
    }
  },

  {
    name: 'animechar',
    aliases: ['character', 'animecharacter'],
    category: 'anime',
    description: 'Look up an anime character',
    usage: '.animechar levi',
    cooldown: 3,
    async execute(ctx) {
      const name = ctx.argsText?.trim()
      if (!name) throw new UserError('Which character? e.g. .animechar levi')

      const c = await ctx.services.anilist.character(name)
      if (!c) throw new UserError(`I could not find a character matching "${name}".`)

      const lines = [`👤 *${c.name}*`]
      if (c.nativeName) lines.push(`_${c.nativeName}_`)
      const facts = [c.gender, c.age ? `age ${c.age}` : null, c.bloodType ? `blood ${c.bloodType}` : null].filter(Boolean)
      if (facts.length) lines.push(facts.join(' · '))
      if (c.appearsIn.length) lines.push(`🎬 ${c.appearsIn.join(', ')}`)
      if (c.favourites) lines.push(`❤️ ${c.favourites.toLocaleString('en-US')} favourites`)
      if (c.description) lines.push(`\n${TRIM(c.description, 600)}`)
      if (c.url) lines.push(`\n🔗 ${c.url}`)

      if (c.image && ctx.sock) {
        return ctx.sock.sendMessage(ctx.chat, { image: { url: c.image }, caption: lines.join('\n') })
      }
      return ctx.reply(lines.join('\n'))
    }
  },

  // ── reaction images (nekos.best, no key) ──
  ...[
    ['waifu', 'waifu', 'a random waifu image'],
    ['neko', 'neko', 'a random neko image'],
    ['husbando', 'husbando', 'a random husbando image'],
    ['kemonomimi', 'kemonomimi', 'a random kemonomimi image']
  ].map(([name, endpoint, description]) => ({
    name,
    category: 'anime',
    description: `Send ${description} (nekos.best)`,
    cooldown: 3,
    async execute(ctx) {
      const image = await nekosImage(name, endpoint)
      const caption = `✨ *${name}*${image.artist ? `\n_art by ${image.artist}_` : ''}\n\n_source: nekos.best_`
      return ctx.sock.sendMessage(ctx.chat, { image: { url: image.url }, caption })
    }
  })),

  {
    name: 'awoo',
    aliases: ['animehug', 'animepat'],
    category: 'anime',
    description: 'An anime reaction GIF (nekos.best)',
    cooldown: 3,
    async execute(ctx) {
      const endpoint = ['hug', 'pat', 'kiss', 'dance', 'smug'][Math.floor(Math.random() * 5)]
      const data = await fetchJson(`https://nekos.best/api/v2/${endpoint}`, { timeout: 8000, retries: 1 })
      const first = data?.results?.[0]
      if (!first?.url) throw new UserError('No GIF came back. Try again.')

      const target = ctx.mentions?.[0]?.split('@')[0]
      const caption = target ? `*${endpoint}* → @${target}` : `*${endpoint}*`
      return ctx.sock.sendMessage(ctx.chat, {
        video: { url: first.url },
        gifPlayback: true,
        caption,
        ...(ctx.mentions?.length ? { mentions: [ctx.mentions[0]] } : {})
      })
    }
  },

  {
    name: 'animequote',
    aliases: ['aniquote'],
    category: 'anime',
    description: 'A random anime quote (animechan API, with attribution)',
    cooldown: 3,
    async execute(ctx) {
      const data = await fetchJson('https://api.animechan.io/v1/quotes/random', { timeout: 8000, retries: 1 })
      const q = data?.data ?? data
      const quote = q?.content ?? q?.quote
      const character = q?.character?.name ?? q?.character
      const anime = q?.anime?.name ?? q?.anime
      if (!quote) throw new UserError('The quote API returned nothing usable.')

      return ctx.reply(`❝ ${quote} ❞\n\n— *${character ?? 'Unknown'}*${anime ? `, _${anime}_` : ''}`)
    }
  }
]
