/**
 * Words + riddles for the game commands.
 *
 *   words    random-word-api.herokuapp.com  (free, keyless)
 *   riddles  riddles-api.vercel.app         (free, keyless)
 *
 * Word games fall back to a small bundled list only if the word API is down —
 * that fallback is labelled in the reply so nobody thinks it is live data.
 */

import { fetchJson } from '../lib/http.js'

const TIMEOUT = 8000

const FALLBACK_WORDS = [
  'elephant', 'computer', 'javascript', 'whisper', 'galaxy', 'harmony', 'phantom',
  'jubilee', 'kangaroo', 'lantern', 'mystery', 'octopus', 'sandwich', 'tornado',
  'velocity', 'workshop', 'yodeling', 'zeppelin', 'bracket', 'cactus'
]

function pickLocal() {
  return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)]
}

/** One random word. Returns { word, source }. */
export async function randomWord({ minLength = 0, maxLength = 99 } = {}) {
  try {
    // The API takes a fixed length, so ask for a length inside the range.
    const length = minLength + Math.floor(Math.random() * Math.max(1, Math.min(maxLength, 12) - minLength + 1))
    const data = await fetchJson(`https://random-word-api.herokuapp.com/word?length=${length}`, {
      timeout: TIMEOUT,
      retries: 1
    })
    const word = Array.isArray(data) ? data[0] : null
    if (word && /^[a-z]+$/i.test(word)) return { word: word.toLowerCase(), source: 'random-word-api' }
  } catch {
    /* fall through */
  }
  return { word: pickLocal(), source: 'bundled list (word API unavailable)' }
}

/** Several random words at once (used by word chain / typing races). */
export async function randomWords(count = 5, length = 5) {
  try {
    const data = await fetchJson(`https://random-word-api.herokuapp.com/word?number=${count}&length=${length}`, {
      timeout: TIMEOUT,
      retries: 1
    })
    const words = (Array.isArray(data) ? data : []).filter((w) => /^[a-z]+$/i.test(w)).map((w) => w.toLowerCase())
    if (words.length) return { words, source: 'random-word-api' }
  } catch {
    /* fall through */
  }
  const words = Array.from({ length: count }, pickLocal)
  return { words, source: 'bundled list (word API unavailable)' }
}

/** Riddle with its answer, for the .riddle command. */
export async function riddle() {
  const data = await fetchJson('https://riddles-api.vercel.app/random', { timeout: TIMEOUT, retries: 2 })
  if (!data?.riddle || !data?.answer) throw new Error('riddle API returned an unexpected payload')
  return { question: String(data.riddle).trim(), answer: String(data.answer).trim(), source: 'riddles-api' }
}

export default { randomWord, randomWords, riddle }
