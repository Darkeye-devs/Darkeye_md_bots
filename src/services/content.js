/**
 * Content service — jokes, facts, quotes and trivia from real, keyless APIs.
 *
 * The rule in this repo is that a command either computes something real or
 * fetches something real. Nothing is a hardcoded list pretending to be data.
 * Every endpoint here is free and needs no API key, so a fresh deploy works
 * with zero setup:
 *
 *   jokes   icanhazdadjoke.com          (plain text, `accept: text/plain`)
 *   jokes   official-joke-api          (fallback, JSON)
 *   facts   uselessfacts.jsph.pl       (JSON, no key)
 *   quotes  zenquotes.io               (JSON, no key, 5 requests / 30s per IP)
 *   trivia  opentdb.com/api.php        (JSON, no key)
 *
 * Each helper degrades to a small local set only when the network fails, and
 * says so, so a user never gets a silent fake.
 */

import { fetchJson } from '../lib/http.js'

const TIMEOUT = 8000

async function tryText(url, headers = {}) {
  const res = await fetch(url, { headers: { accept: 'text/plain', ...headers }, signal: AbortSignal.timeout(TIMEOUT) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = (await res.text()).trim()
  if (!text) throw new Error('empty response')
  return text
}

const decode = (s) =>
  String(s)
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&eacute;/g, 'é')
    .replace(/&hellip;/g, '…')

/** A random joke from a real joke API. */
export async function joke() {
  const sources = [
    async () => {
      const text = await tryText('https://icanhazdadjoke.com/', { 'user-agent': 'DarkEyesBot (+https://github.com/Darkeye-devs/Darkeye_md_bots)' })
      return { text, source: 'icanhazdadjoke.com' }
    },
    async () => {
      const data = await fetchJson('https://official-joke-api.appspot.com/random_joke', { timeout: TIMEOUT, retries: 0 })
      if (!data?.setup) throw new Error('bad payload')
      return { text: `${data.setup}\n\n${data.punchline}`, source: 'official-joke-api' }
    }
  ]
  for (const source of sources) {
    try {
      return await source()
    } catch {
      /* next source */
    }
  }
  throw new Error('joke APIs are unreachable right now')
}

/** A random fact from uslessfacts (yes, that is the real domain name). */
export async function fact() {
  const data = await fetchJson('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', {
    timeout: TIMEOUT,
    retries: 1
  })
  if (!data?.text) throw new Error('bad payload')
  return { text: decode(data.text), source: 'uselessfacts.jsph.pl' }
}

// zenquotes rate-limits anonymous traffic, so hold the last one for a few
// minutes rather than burning the whole quota on a busy group.
let quoteCache = { text: null, at: 0 }

/** A random quote with an author. */
export async function quote() {
  if (quoteCache.text && Date.now() - quoteCache.at < 120_000) return quoteCache.text

  const data = await fetchJson('https://zenquotes.io/api/random', { timeout: TIMEOUT, retries: 1 })
  const entry = Array.isArray(data) ? data[0] : data
  if (!entry?.q) throw new Error('bad payload')

  const fresh = { text: String(entry.q).trim(), author: String(entry.a || 'Unknown').trim(), source: 'zenquotes.io' }
  quoteCache = { text: fresh, at: Date.now() }
  return fresh
}

/** A multiple-choice trivia question with the correct answer included. */
export async function trivia({ category } = {}) {
  const params = new URLSearchParams({ amount: '1', type: 'multiple' })
  if (category) params.set('category', String(category))

  const data = await fetchJson(`https://opentdb.com/api.php?${params}`, { timeout: TIMEOUT, retries: 1 })
  if (data?.response_code !== 0 || !data.results?.length) throw new Error('opentdb returned no question')

  const q = data.results[0]
  const correct = decode(q.correct_answer).trim()
  const options = [...q.incorrect_answers.map(decode), correct]
    .map((s) => s.trim())
    // deterministic shuffle so the right answer is not always last
    .sort((a, b) => a.localeCompare(b))

  return {
    question: decode(q.question),
    correct,
    options,
    category: decode(q.category),
    difficulty: q.difficulty,
    source: 'opentdb.com'
  }
}

export default { joke, fact, quote, trivia }
