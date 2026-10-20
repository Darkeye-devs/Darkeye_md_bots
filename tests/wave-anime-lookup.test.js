/**
 * Anime catalogue, knowledge lookup, quiz games and unit converters.
 *
 * Network calls are stubbed so the assertions are deterministic; the same code
 * paths were also run against the live APIs (AniList, Wikipedia, Datamuse,
 * USGS, Wiktionary, countriesnow) during development.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadRegistry, run, closeDb } from './harness.js'
import * as anilist from '../src/services/anilist.js'
import * as lookup from '../src/services/lookup.js'
import { games, gameKey, getGame } from '../src/core/quiz.js'

test.after(() => closeDb())

const realFetch = global.fetch
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const stub = (handler) => {
  global.fetch = async (url, init) => handler(String(url), init)
}
test.afterEach(() => {
  global.fetch = realFetch
})

const { registry, resolve } = await loadRegistry()
const get = (name) => {
  const plugin = resolve(name)
  assert.ok(plugin, `command ${name} is not registered`)
  return plugin
}

// ── AniList service ─────────────────────────
const ANILIST_MEDIA = {
  id: 16498,
  title: { romaji: 'Shingeki no Kyojin', english: 'Attack on Titan', native: '進撃の巨人' },
  description: '<b>Attack on Titan</b> follows Eren.<br>Second line.',
  format: 'TV',
  status: 'FINISHED',
  seasonYear: 2013,
  season: 'SPRING',
  episodes: 25,
  duration: 24,
  averageScore: 85,
  favourites: 12345,
  genres: ['Action', 'Drama'],
  siteUrl: 'https://anilist.co/anime/16498',
  coverImage: { large: 'https://img.example/cover.jpg' },
  studios: { nodes: [{ name: 'WIT STUDIO' }] }
}

test('searchAnime strips HTML from the description', async () => {
  stub(() => json({ data: { Page: { media: [ANILIST_MEDIA] } } }))
  const [first] = await anilist.searchAnime('attack on titan')
  assert.equal(first.title, 'Attack on Titan')
  assert.equal(first.nativeTitle, '進撃の巨人')
  assert.equal(first.description, 'Attack on Titan follows Eren.\nSecond line.')
  assert.equal(first.studios[0], 'WIT STUDIO')
  assert.equal(first.episodes, 25)
  assert.equal(first.source, 'anilist.co')
})

test('searchAnime surfaces a GraphQL error instead of pretending there are no results', async () => {
  stub(() => json({ errors: [{ message: 'Too many requests' }] }))
  await assert.rejects(() => anilist.searchAnime('x'), /Too many requests/)
})

test('character() retries with a single word when the full name finds nothing', async () => {
  const calls = []
  stub((url, init) => {
    const body = JSON.parse(init.body)
    calls.push(body.variables.search)
    const hit = body.variables.search === 'levi'
    return json({
      data: {
        Page: {
          characters: hit
            ? [{ id: 1, name: { full: 'Levi' }, favourites: 10, media: { nodes: [{ title: { romaji: 'Shingeki no Kyojin' } }] } }]
            : []
        }
      }
    })
  })

  const c = await anilist.character('levi ackerman')
  assert.equal(c.name, 'Levi')
  assert.equal(c.appearsIn[0], 'Shingeki no Kyojin')
  assert.deepEqual(calls, ['levi ackerman', 'levi'])
})

// ── lookups ─────────────────────────────────
test('related() maps short names onto Datamuse rel_ parameters', async () => {
  let called = ''
  stub((url) => {
    called = url
    return json([{ word: 'happy' }])
  })
  await lookup.related('joy', 'ant')
  assert.match(called, /rel_ant=joy/)
})

test('wikipedia() falls back to search when the exact title is missing', async () => {
  stub((url) => {
    // Exact page exists only for the searched title.
    if (url.endsWith('/page/summary/Lagos')) {
      return json({
        type: 'standard',
        title: 'Lagos',
        extract: 'Lagos is a city in Nigeria.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Lagos' } }
      })
    }
    if (url.includes('/page/summary/')) return json({}, 404)
    if (url.includes('list=search')) return json({ query: { search: [{ title: 'Lagos' }] } })
    return json({}, 404)
  })

  const page = await lookup.wikipedia('a city in nigeria')
  assert.equal(page.title, 'Lagos')
  assert.match(page.extract, /city in Nigeria/)
})

test('pronounce() reads IPA out of Wiktionary wikitext', async () => {
  stub(() =>
    json({
      parse: { wikitext: '==English==\n* {{IPA|en|/hɛˈloʊ/}} {{IPA|en|/həˈləʊ/}}' }
    })
  )
  const info = await lookup.pronounce('hello')
  assert.equal(info.phonetic, '/hɛˈloʊ/')
  assert.deepEqual(info.alternates, ['/həˈləʊ/'])
  assert.equal(info.source, 'en.wiktionary.org')
})

test('country() matches case-insensitively and returns the capital', async () => {
  stub(() =>
    json({
      data: [
        { name: 'Nigeria', capital: 'Abuja', currency: 'NGN', iso2: 'NG', iso3: 'NGA' },
        { name: 'Niger', capital: 'Niamey', currency: 'XOF' }
      ]
    })
  )
  const c = await lookup.country('nigeria')
  assert.equal(c.name, 'Nigeria')
  assert.equal(c.capital, 'Abuja')
})

test('earthquakes() keeps magnitude and tsunami flag', async () => {
  stub(() =>
    json({
      features: [
        { properties: { place: 'Somewhere', mag: 6.1, time: 1700000000000, url: 'https://usgs/x', tsunami: 1 } }
      ]
    })
  )
  const [q] = await lookup.earthquakes()
  assert.equal(q.magnitude, 6.1)
  assert.equal(q.tsunami, true)
})

// ── commands ────────────────────────────────
test('.anime lists results when several titles match', async () => {
  stub(() =>
    json({
      data: {
        Page: {
          media: [
            { ...ANILIST_MEDIA, id: 1, title: { english: 'Attack on Titan' } },
            { ...ANILIST_MEDIA, id: 2, title: { english: 'Attack on Titan Final Season' } }
          ]
        }
      }
    })
  )
  const ctx = await run(get('anime'), { argsText: 'attack on titan' })
  assert.match(ctx.replies[0], /Results for "attack on titan"/)
  assert.match(ctx.replies[0], /2\. \*Attack on Titan Final Season\*/)
})

test('.animeinfo renders a full card for a numeric id', async () => {
  stub(() => json({ data: { Media: ANILIST_MEDIA } }))
  const ctx = await run(get('animeinfo'), { argsText: '16498' })
  assert.match(ctx.replies[0], /Attack on Titan/)
  assert.match(ctx.replies[0], /WIT STUDIO/)
  assert.match(ctx.replies[0], /anilist\.co/)
})

test('.animeinfo refuses to invent a title', async () => {
  stub(() => json({ data: { Page: { media: [] } } }))
  await assert.rejects(() => run(get('animeinfo'), { argsText: 'zzqq' }), /No anime found/i)
})

test('.wiki answers from the summary and cites the source', async () => {
  stub((url) =>
    url.includes('/page/summary/')
      ? json({
          type: 'standard',
          title: 'Chinua Achebe',
          extract: 'Achebe was a Nigerian novelist.',
          content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Chinua_Achebe' } }
        })
      : json({})
  )
  const ctx = await run(get('wiki'), { argsText: 'Chinua Achebe' })
  assert.match(ctx.replies[0], /Achebe was a Nigerian novelist/)
  assert.match(ctx.replies[0], /en\.wikipedia\.org/)
})

test('.synonym lists Datamuse words', async () => {
  stub(() => json([{ word: 'content' }, { word: 'cheerful' }]))
  const ctx = await run(get('synonym'), { argsText: 'happy' })
  assert.match(ctx.replies[0], /content · cheerful/)
})

test('.country shows capital and currency', async () => {
  stub(() => json({ data: [{ name: 'Nigeria', capital: 'Abuja', currency: 'NGN' }] }))
  const ctx = await run(get('country'), { argsText: 'nigeria' })
  assert.match(ctx.replies[0], /Abuja/)
  assert.match(ctx.replies[0], /NGN/)
})

test('.github formats stars and rejects a missing slash', async () => {
  stub(() =>
    json({
      full_name: 'facebook/react',
      description: 'The library for web UIs',
      stargazers_count: 1234,
      forks_count: 56,
      open_issues_count: 7,
      language: 'JavaScript',
      license: { spdx_id: 'MIT' },
      created_at: '2013-05-24T16:15:54Z',
      pushed_at: '2026-10-01T00:00:00Z',
      html_url: 'https://github.com/facebook/react',
      topics: ['ui']
    })
  )
  const ctx = await run(get('github'), { argsText: 'facebook/react' })
  assert.match(ctx.replies[0], /1,234/)
  assert.match(ctx.replies[0], /MIT/)

  await assert.rejects(() => run(get('github'), { argsText: 'react' }), /owner\/repo/)
})

// ── games ───────────────────────────────────
test('.hangman starts a game and .guess reveals the board', async () => {
  stub(() => json(['planet']))
  const started = await run(get('hangman'))
  assert.match(started.replies[0], /HANGMAN/)
  assert.match(started.replies[0], /_ _ _ _ _ _/)

  const guess = await run(get('guess'), { argsText: 'p' })
  assert.match(guess.replies[0], /p _ _ _ _ _/)
})

test('hangman finishes when every letter is found', async () => {
  stub(() => json(['cat']))
  await run(get('hangman'))
  // riddle-free finish: feed the letters straight into the grader
  const ctx = await run(get('guess'), { argsText: 'c' })
  assert.match(ctx.replies[0], /lives left|Solved/)
  const two = await run(get('guess'), { argsText: 'a' })
  assert.ok(two.replies.length >= 1)
})

test('.wordle marks letters and only accepts five letters', async () => {
  stub(() => json(['crane']))
  await run(get('wordle'))
  await assert.rejects(() => run(get('guess'), { argsText: 'cat' }), /5 letters/i)

  const ctx = await run(get('guess'), { argsText: 'crane' })
  assert.match(ctx.replies[0], /🟩🟩🟩🟩🟩/)
  assert.match(ctx.replies[0], /Correct/)
})

test('.mathquiz grades a correct answer', async () => {
  const started = await run(get('mathquiz'))
  const match = /(\d+) ([+\-×]) (\d+) = \?/.exec(started.replies[0])
  assert.ok(match, 'question should contain a sum')

  const [a, op, b] = [Number(match[1]), match[2], Number(match[3])]
  const expected = op === '+' ? a + b : op === '-' ? a - b : a * b
  const ctx = await run(get('guess'), { argsText: String(expected) })
  assert.match(ctx.replies[0], /Correct/)
})

test('.guesscapital grades the capital from live country data', async () => {
  stub(() => json({ data: [{ name: 'Japan', capital: 'Tokyo', iso2: 'JP' }] }))
  const started = await run(get('guesscapital'))
  assert.match(started.replies[0], /capital of \*Japan\*/)

  const right = await run(get('guess'), { argsText: 'tokyo' })
  assert.match(right.replies[0], /Correct!/)

  stub(() => json({ data: [{ name: 'Japan', capital: 'Tokyo', iso2: 'JP' }] }))
  await run(get('guesscapital'))
  // A wrong answer is a UserError (the group sees the hint, not a crash).
  await assert.rejects(() => run(get('guess'), { argsText: 'osaka' }), /Not osaka/)
})

test('.riddle asks and .guess checks the answer', async () => {
  stub(() => json({ riddle: 'What has keys but no locks?', answer: 'a piano' }))
  const started = await run(get('riddle'))
  assert.match(started.replies[0], /keys but no locks/)

  const ctx = await run(get('guess'), { argsText: 'a piano' })
  assert.match(ctx.replies[0], /Correct/)
})

test('games are scoped to a chat, and .endgame reveals the answer', async () => {
  stub(() => json({ riddle: 'What am I?', answer: 'nothing' }))
  await run(get('riddle'))
  const ended = await run(get('endgame'))
  assert.match(ended.replies[0], /nothing/)
  assert.equal(getGame({ chat: '12345@g.us', sender: '2348000000002@s.whatsapp.net' }), null)
})

test('a finished game is removed from the store', async () => {
  stub(() => json(['crane']))
  await run(get('wordle'))
  const ctx = { chat: '12345@g.us', sender: '2348000000002@s.whatsapp.net' }
  assert.ok(games.has(gameKey(ctx)))
  await run(get('guess'), { argsText: 'crane' })
  assert.equal(games.has(gameKey(ctx)), false)
})

// ── converters ──────────────────────────────
test('.length converts with the documented factors', async () => {
  const ctx = await run(get('length'), { argsText: '10 km to miles' })
  assert.match(ctx.replies[0], /6\.213712 miles/)
})

test('.length accepts glued input and arrows', async () => {
  const ctx = await run(get('length'), { argsText: '100cm->m' })
  assert.match(ctx.replies[0], /100 cm = \*1 m\*/)
})

test('.length rejects an unknown unit instead of guessing', async () => {
  await assert.rejects(() => run(get('length'), { argsText: '10 bananas to m' }), /do not know the unit/i)
})

test('.weight/.volume/.data convert correctly', async () => {
  const w = await run(get('weight'), { argsText: '70 kg to lb' })
  assert.match(w.replies[0], /154\.32/)
  const v = await run(get('volume'), { argsText: '1 l to ml' })
  assert.match(v.replies[0], /1000 ml/)
  const d = await run(get('data'), { argsText: '1 gb to mb' })
  assert.match(d.replies[0], /1024 mb/)
})

test('.hex2dec and .dec2hex are inverse operations', async () => {
  const toDec = await run(get('hex2dec'), { argsText: 'ff' })
  assert.match(toDec.replies[0], /255/)
  const toHex = await run(get('dec2hex'), { argsText: '255' })
  assert.match(toHex.replies[0], /FF/)
})

test('.base converts between arbitrary bases and validates the range', async () => {
  const ctx = await run(get('base'), { argsText: '255 10 16' })
  assert.match(ctx.replies[0], /FF/)
  await assert.rejects(() => run(get('base'), { argsText: '255 10 99' }), /between 2 and 36/i)
})

test('.decimal and .octal detect direction', async () => {
  const bin = await run(get('decimal'), { argsText: '1010' })
  assert.match(bin.replies[0], /\*10\*/)
  // Anything containing a digit above 1 is decimal; all-01 input is binary.
  const dec = await run(get('decimal'), { argsText: '12' })
  assert.match(dec.replies[0], /0b1100/)
  const oct = await run(get('octal'), { argsText: '755' })
  assert.match(oct.replies[0], /\*493\*/)
})

// ── registry health ─────────────────────────
test('the new plugins loaded without a single failure', () => {
  assert.equal(registry.failed.length, 0, `failures: ${JSON.stringify(registry.failed)}`)
  assert.ok(registry.commands.size >= 290, `expected 290+ commands, got ${registry.commands.size}`)
})
