/**
 * Lookup service — the "ask the internet a fact" layer.
 *
 * Every endpoint here is public and keyless. None of them are scraped HTML;
 * if one changes shape the command fails loudly instead of inventing data.
 *
 *   wikipedia    en.wikipedia.org/api/rest_v1        (REST summary + search)
 *   wikiquote    en.wikiquote.org/api/rest_v1
 *   urban        api.urbandictionary.com/v0/define
 *   datamuse     api.datamuse.com/words              (syn/ant/rhyme/means-like)
 *   duckduckgo   api.duckduckgo.com                  (instant answers)
 *   countries    countriesnow.space                  (capital, currency, population)
 *   first.org    api.first.org                       (ISO country names/regions)
 *   github       api.github.com                      (60 req/h unauthenticated)
 *   earthquakes  earthquake.usgs.gov                 (USGS, no key)
 *   dictionary   api.dictionaryapi.dev               (phonetics)
 */

import { fetchJson } from '../lib/http.js'

const TIMEOUT = 10_000
const UA = 'DarkEyesBot/1.0 (+https://github.com/Darkeye-devs/Darkeye_md_bots)'

const strip = (html) =>
  String(html ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Wikipedia page summary. Returns null when the page does not exist.
 * `depth` guards the search fallback: a page that 404s can lead to a search hit
 * that 404s again, which would otherwise recurse forever.
 */
export async function wikipedia(term, depth = 0) {
  const title = encodeURIComponent(String(term).trim().replace(/\s+/g, '_'))
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
    headers: { 'user-agent': UA, accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT)
  })

  if (res.status === 404) {
    // Fall back to search so "who is the president of nigeria" style input works.
    if (depth >= 1) return null
    const found = await wikiSearch(term)
    if (!found || found.toLowerCase() === String(term).toLowerCase()) return null
    return wikipedia(found, depth + 1)
  }
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`)

  const data = await res.json()
  if (data.type === 'disambiguation' && depth < 1) {
    const found = await wikiSearch(term)
    if (found && found.toLowerCase() !== String(term).toLowerCase()) return wikipedia(found, depth + 1)
  }
  if (!data.extract) return null

  return {
    title: data.title,
    extract: data.extract,
    description: data.description ?? null,
    url: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${title}`,
    thumbnail: data.thumbnail?.source ?? null,
    source: 'en.wikipedia.org'
  }
}

/** Top Wikipedia search result title. */
export async function wikiSearch(term) {
  const data = await fetchJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&srlimit=1`,
    { timeout: TIMEOUT, headers: { 'user-agent': UA } }
  )
  return data?.query?.search?.[0]?.title ?? null
}

/** Wikipedia search results with snippets. */
export async function wikiResults(term, limit = 5) {
  const data = await fetchJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&srlimit=${limit}`,
    { timeout: TIMEOUT, headers: { 'user-agent': UA } }
  )
  return (data?.query?.search ?? []).map((r) => ({
    title: r.title,
    snippet: strip(r.snippet),
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/\s+/g, '_'))}`
  }))
}

/** Wikiquote search summary for a person/topic. */
export async function wikiquote(term) {
  const title = encodeURIComponent(String(term).trim().replace(/\s+/g, '_'))
  const res = await fetch(`https://en.wikiquote.org/api/rest_v1/page/summary/${title}`, {
    headers: { 'user-agent': UA, accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT)
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Wikiquote HTTP ${res.status}`)
  const data = await res.json()
  if (!data.extract) return null
  return {
    title: data.title,
    extract: data.extract,
    url: data.content_urls?.desktop?.page ?? `https://en.wikiquote.org/wiki/${title}`,
    source: 'en.wikiquote.org'
  }
}

/** Urban Dictionary definition. */
export async function urban(term) {
  const data = await fetchJson(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`, {
    timeout: TIMEOUT,
    retries: 1
  })
  const entry = (data?.list ?? []).sort((a, b) => (b.thumbs_up ?? 0) - (a.thumbs_up ?? 0))[0]
  if (!entry) return null
  return {
    word: entry.word,
    definition: strip(entry.definition),
    example: strip(entry.example),
    author: entry.author,
    thumbsUp: entry.thumbs_up,
    thumbsDown: entry.thumbs_down,
    url: entry.permalink,
    source: 'urbandictionary.com'
  }
}

/**
 * Datamuse word relations. Datamuse spells them `rel_syn`, `rel_ant`, `rel_rhy`,
 * so short names are mapped here rather than at every call site.
 */
const DATAMUSE_REL = {
  syn: 'rel_syn',
  ant: 'rel_ant',
  rhy: 'rel_rhy',
  nry: 'rel_nry',
  trg: 'rel_trg',
  spo: 'rel_spo',
  jja: 'rel_jja',
  jjb: 'rel_jjb',
  hom: 'rel_hom',
  ml: 'ml',
  sl: 'sl'
}

export async function related(term, rel = 'syn', max = 12) {
  const param = DATAMUSE_REL[rel] ?? rel
  const data = await fetchJson(
    `https://api.datamuse.com/words?${param}=${encodeURIComponent(term)}&max=${max}`,
    { timeout: TIMEOUT, retries: 1 }
  )
  return (data ?? []).map((w) => w.word)
}

/** DuckDuckGo instant answer. Empty abstract is normal — callers must handle it. */
export async function instantAnswer(term) {
  const data = await fetchJson(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(term)}&format=json&no_html=1&skip_disambig=1`,
    { timeout: TIMEOUT, retries: 1 }
  )
  const topics = (data?.RelatedTopics ?? [])
    .flatMap((t) => (t.Topics ? t.Topics : [t]))
    .map((t) => ({ text: t.Text, url: t.FirstURL }))
    .filter((t) => t.text)
    .slice(0, 6)

  return {
    heading: data?.Heading || null,
    abstract: strip(data?.AbstractText),
    abstractUrl: data?.AbstractURL || null,
    source: data?.AbstractSource || null,
    answer: strip(data?.Answer),
    definition: strip(data?.Definition),
    topics
  }
}

/** Country facts. */
export async function country(term) {
  const data = await fetchJson(
    'https://countriesnow.space/api/v0.1/countries/info?returns=capital,currency,population,iso2,iso3,flag',
    { timeout: TIMEOUT, retries: 1 }
  )
  const list = data?.data ?? []
  const needle = String(term).trim().toLowerCase()
  const match =
    list.find((c) => c.name?.toLowerCase() === needle) ??
    list.find((c) => c.name?.toLowerCase().startsWith(needle)) ??
    list.find((c) => c.name?.toLowerCase().includes(needle))

  if (!match) return null
  return {
    name: match.name,
    capital: match.capital ?? null,
    currency: match.currency ?? null,
    population: match.population ?? null,
    iso2: match.iso2 ?? null,
    iso3: match.iso3 ?? null,
    flag: match.flag ?? null,
    source: 'countriesnow.space'
  }
}

/** Every country + capital, for quiz commands. */
export async function capitals() {
  const data = await fetchJson('https://countriesnow.space/api/v0.1/countries/capital', {
    timeout: TIMEOUT,
    retries: 1
  })
  return (data?.data ?? [])
    .filter((c) => c.name && c.capital && c.capital !== 'N/A')
    .map((c) => ({ name: c.name, capital: c.capital, iso2: c.iso2 }))
}

/** GitHub repository (or user) facts. Unauthenticated: 60 requests/hour per IP. */
export async function github(target) {
  const res = await fetch(`https://api.github.com/repos/${target}`, {
    headers: { 'user-agent': UA, accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(TIMEOUT)
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`)

  const r = await res.json()
  return {
    name: r.full_name,
    description: r.description,
    stars: r.stargazers_count,
    forks: r.forks_count,
    issues: r.open_issues_count,
    language: r.language,
    license: r.license?.spdx_id ?? null,
    created: r.created_at,
    updated: r.pushed_at,
    url: r.html_url,
    topics: r.topics ?? [],
    source: 'api.github.com'
  }
}

/** Recent significant earthquakes (USGS). */
export async function earthquakes() {
  const data = await fetchJson(
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson',
    { timeout: TIMEOUT, retries: 1 }
  )
  return (data?.features ?? []).slice(0, 6).map((f) => ({
    place: f.properties?.place,
    magnitude: f.properties?.mag,
    time: f.properties?.time,
    url: f.properties?.url,
    tsunami: f.properties?.tsunami === 1
  }))
}

/**
 * Pronunciation: Wiktionary's wikitext carries the IPA for most English words.
 * dictionaryapi.dev is used only as a fallback, because it intermittently
 * answers 404 for words that exist (seen live on 2026-10-20).
 */
export async function pronounce(word) {
  const term = String(word).trim()

  try {
    const data = await fetchJson(
      `https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(term)}&prop=wikitext&format=json&formatversion=2`,
      { timeout: TIMEOUT, headers: { 'user-agent': UA } }
    )
    const wikitext = data?.parse?.wikitext ?? ''
    const ipa = [...wikitext.matchAll(/\{\{IPA\|en\|([^}|]+)/g)].map((m) => m[1].trim())
    if (ipa.length) {
      return {
        word: term,
        phonetic: ipa[0],
        alternates: [...new Set(ipa)].slice(1, 4),
        audio: null,
        source: 'en.wiktionary.org'
      }
    }
  } catch {
    /* fall through to the dictionary API */
  }

  try {
    const data = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`, {
      timeout: TIMEOUT,
      retries: 2
    })
    const entry = Array.isArray(data) ? data[0] : null
    if (!entry) return null
    return {
      word: entry.word,
      phonetic: entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || null,
      alternates: [],
      audio: entry.phonetics?.find((p) => p.audio)?.audio || null,
      meanings: (entry.meanings ?? []).slice(0, 3).map((m) => ({
        partOfSpeech: m.partOfSpeech,
        definition: m.definitions?.[0]?.definition ?? null
      })),
      source: 'dictionaryapi.dev'
    }
  } catch {
    return null
  }
}

export default {
  wikipedia,
  wikiSearch,
  wikiResults,
  wikiquote,
  urban,
  related,
  instantAnswer,
  country,
  capitals,
  github,
  earthquakes,
  pronounce
}
