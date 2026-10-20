/**
 * AniList service — anime/manga/character data.
 *
 * AniList exposes a public GraphQL API at https://graphql.anilist.co with no key
 * required. Rate limit is ~90 requests/minute, which is plenty for a chat bot.
 *
 * Docs: https://docs.anilist.co
 */

const ENDPOINT = 'https://graphql.anilist.co'
const TIMEOUT = 12_000

async function query(gql, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: gql, variables }),
    signal: AbortSignal.timeout(TIMEOUT)
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok || body.errors?.length) {
    const message = body.errors?.[0]?.message || `AniList HTTP ${res.status}`
    throw new Error(message)
  }
  return body.data
}

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  description(asHtml: false)
  format
  status
  season
  seasonYear
  episodes
  chapters
  volumes
  duration
  averageScore
  meanScore
  popularity
  favourites
  genres
  countryOfOrigin
  siteUrl
  coverImage { large color }
  bannerImage
  studios(isMain: true) { nodes { name } }
  nextAiringEpisode { episode airingAt timeUntilAiring }
`

const clean = (text) =>
  String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()

function summarise(media) {
  if (!media) return null
  return {
    id: media.id,
    title: media.title?.english || media.title?.romaji || media.title?.native || 'Unknown',
    nativeTitle: media.title?.native ?? null,
    description: clean(media.description).slice(0, 900),
    format: media.format,
    status: media.status,
    year: media.seasonYear,
    season: media.season,
    episodes: media.episodes,
    chapters: media.chapters,
    volumes: media.volumes,
    duration: media.duration,
    score: media.averageScore,
    popularity: media.popularity,
    favourites: media.favourites,
    genres: media.genres ?? [],
    country: media.countryOfOrigin,
    url: media.siteUrl,
    cover: media.coverImage?.large ?? null,
    banner: media.bannerImage ?? null,
    studios: (media.studios?.nodes ?? []).map((s) => s.name),
    nextEpisode: media.nextAiringEpisode?.episode ?? null,
    source: 'anilist.co'
  }
}

/** Search anime by title. Returns an array (may be empty). */
export async function searchAnime(term, { limit = 5 } = {}) {
  const data = await query(
    `query ($search: String, $perPage: Int) {
      Page(perPage: $perPage) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} }
      }
    }`,
    { search: term, perPage: limit }
  )
  return (data?.Page?.media ?? []).map(summarise)
}

/** Search manga (includes manhwa/manhua via countryOfOrigin). */
export async function searchManga(term, { limit = 5 } = {}) {
  const data = await query(
    `query ($search: String, $perPage: Int) {
      Page(perPage: $perPage) {
        media(search: $search, type: MANGA, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} }
      }
    }`,
    { search: term, perPage: limit }
  )
  return (data?.Page?.media ?? []).map(summarise)
}

/** Exact entry by AniList id. */
export async function animeById(id) {
  const data = await query(`query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`, {
    id: Number(id)
  })
  return summarise(data?.Media)
}

export async function mangaById(id) {
  const data = await query(`query ($id: Int) { Media(id: $id, type: MANGA) { ${MEDIA_FIELDS} } }`, {
    id: Number(id)
  })
  return summarise(data?.Media)
}

/** Currently trending anime. */
export async function trending({ limit = 5 } = {}) {
  const data = await query(
    `query ($perPage: Int) {
      Page(perPage: $perPage) { media(type: ANIME, sort: TRENDING_DESC) { ${MEDIA_FIELDS} } }
    }`,
    { perPage: limit }
  )
  return (data?.Page?.media ?? []).map(summarise)
}

/**
 * A character by name, with the anime they appear in.
 * AniList's character search is strict — "levi ackerman" returns nothing while
 * "levi" matches — so fall back to the longest single word before giving up.
 */
export async function character(name) {
  const terms = [name, ...String(name).split(/\s+/).filter((w) => w.length > 2)]
  for (const term of new Set(terms)) {
    const found = await characterOnce(term)
    if (found) return found
  }
  return null
}

async function characterOnce(name) {
  const data = await query(
    `query ($search: String) {
      Page(perPage: 1) {
        characters(search: $search, sort: FAVOURITES_DESC) {
          id
          name { full native alternative }
          description(asHtml: false)
          gender
          age
          bloodType
          favourites
          siteUrl
          image { large }
          media(perPage: 4) { nodes { title { romaji english } } }
        }
      }
    }`,
    { search: name }
  )

  const c = data?.Page?.characters?.[0]
  if (!c) return null
  return {
    id: c.id,
    name: c.name?.full || name,
    nativeName: c.name?.native ?? null,
    description: clean(c.description).slice(0, 700),
    gender: c.gender,
    age: c.age,
    bloodType: c.bloodType,
    favourites: c.favourites,
    url: c.siteUrl,
    image: c.image?.large ?? null,
    appearsIn: (c.media?.nodes ?? []).map((m) => m.title?.english || m.title?.romaji).filter(Boolean),
    source: 'anilist.co'
  }
}

export default { searchAnime, searchManga, animeById, mangaById, trending, character }
