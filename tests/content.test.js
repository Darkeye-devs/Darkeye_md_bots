/**
 * Content commands must hit real APIs — not hardcoded lists. These tests stub
 * global fetch so they are deterministic, and they fail if a command silently
 * goes back to being a handwritten array.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadRegistry, run, closeDb } from './harness.js'
import * as content from '../src/services/content.js'

test.after(() => closeDb())

const realFetch = global.fetch
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const text = (body, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain' } })

function stubFetch(handler) {
  global.fetch = async (url, init) => handler(String(url), init)
}
test.afterEach(() => {
  global.fetch = realFetch
})

// ── the service layer ────────────────────────
test('joke() parses the plain-text icanhazdadjoke response', async () => {
  stubFetch((url) => {
    assert.match(url, /icanhazdadjoke/)
    return text('Why did the eye cross the road?')
  })
  const result = await content.joke()
  assert.equal(result.text, 'Why did the eye cross the road?')
  assert.equal(result.source, 'icanhazdadjoke.com')
})

test('joke() falls back to official-joke-api when the first source dies', async () => {
  stubFetch((url) => {
    if (url.includes('icanhazdadjoke')) throw new Error('network down')
    return json({ setup: 'Setup line', punchline: 'Punch line' })
  })
  const result = await content.joke()
  assert.match(result.text, /Setup line[\s\S]*Punch line/)
  assert.equal(result.source, 'official-joke-api')
})

test('joke() throws instead of inventing a joke when every API is down', async () => {
  stubFetch(() => {
    throw new Error('offline')
  })
  await assert.rejects(() => content.joke(), /unreachable/i)
})

test('fact() decodes HTML entities from uselessfacts', async () => {
  stubFetch(() => json({ text: 'Cats can&#039;t taste sweetness &amp; that is real.' }))
  const result = await content.fact()
  assert.match(result.text, /Cats can't taste sweetness & that is real\./)
  assert.equal(result.source, 'uselessfacts.jsph.pl')
})

test('quote() caches so zenquotes is not hammered', async () => {
  let calls = 0
  stubFetch(() => {
    calls += 1
    return json([{ q: 'The eye that sees', a: 'Dark Eyes' }])
  })
  const first = await content.quote()
  const second = await content.quote()
  assert.equal(first.author, 'Dark Eyes')
  assert.equal(second.text, first.text)
  assert.equal(calls, 1, 'second call should come from cache')
})

test('trivia() decodes the question and keeps the correct answer', async () => {
  stubFetch(() =>
    json({
      response_code: 0,
      results: [
        {
          category: 'Science &amp; Nature',
          difficulty: 'easy',
          question: 'What does HTTP stand for?',
          correct_answer: 'HyperText Transfer Protocol',
          incorrect_answers: ['HyperText Transfer Process', 'Host Transfer Protocol']
        }
      ]
    })
  )
  const result = await content.trivia()
  assert.equal(result.question, 'What does HTTP stand for?')
  assert.equal(result.category, 'Science & Nature')
  assert.equal(result.correct, 'HyperText Transfer Protocol')
  assert.equal(result.options.length, 3)
  assert.ok(result.options.includes('HyperText Transfer Protocol'))
})

test('trivia() rejects a non-zero opentdb response instead of asking a blank question', async () => {
  stubFetch(() => json({ response_code: 2, results: [] }))
  await assert.rejects(() => content.trivia(), /no question/i)
})

// ── the commands themselves ──────────────────
const { resolve } = await loadRegistry()
const get = (name) => {
  const plugin = resolve(name)
  assert.ok(plugin, `command ${name} is not registered`)
  return plugin
}

test('.joke sends whatever the API returned', async () => {
  stubFetch(() => text('A joke from the internet.'))
  const ctx = await run(get('joke'))
  assert.match(ctx.replies[0], /A joke from the internet\./)
})

test('.joke says the API is down instead of using a hardcoded joke', async () => {
  stubFetch(() => {
    throw new Error('offline')
  })
  await assert.rejects(() => run(get('joke')), /unreachable right now/i)
})

test('.fact reports the real API failure rather than a fake fact', async () => {
  stubFetch(() => json({}, 500))
  await assert.rejects(() => run(get('fact')), /not answering|Fact/i)
})

test('.trivia asks a live question and .answer grades it', async () => {
  stubFetch(() =>
    json({
      response_code: 0,
      results: [
        {
          category: 'General Knowledge',
          difficulty: 'medium',
          question: 'Which planet is the Red Planet?',
          correct_answer: 'Mars',
          incorrect_answers: ['Venus', 'Jupiter']
        }
      ]
    })
  )
  const ctx = await run(get('trivia'))
  assert.match(ctx.replies[0], /Which planet is the Red Planet\?/)
  assert.match(ctx.replies[0], /A\. |B\. |C\. /)
  assert.match(ctx.replies[0], /opentdb\.com/)

  const answerCtx = await run(get('answer'), { argsText: 'mars' })
  assert.match(answerCtx.replies[0], /Correct/i)
})

test('.trivia still asks something when opentdb is down, and says it is offline', async () => {
  stubFetch(() => json({ response_code: 1, results: [] }))
  const ctx = await run(get('trivia'))
  assert.match(ctx.replies[0], /TRIVIA/)
  assert.match(ctx.replies[0], /offline question/)
})
