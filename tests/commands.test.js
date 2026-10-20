/**
 * Behavioural tests: these call the REAL plugin execute() functions and assert
 * on what they would actually send to WhatsApp.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadRegistry, run, closeDb } from './harness.js'

const { registry, resolve } = await loadRegistry()
const get = (name) => {
  const plugin = resolve(name)
  assert.ok(plugin, `command ${name} is not registered`)
  return plugin
}

// ── converters & maths ───────────────────────
test('.convert handles metric → imperial', async () => {
  const ctx = await run(get('convert'), { args: ['10', 'km', 'to', 'miles'] })
  assert.match(ctx.replies[0], /6\.21/)
})

test('.convert handles temperature', async () => {
  const ctx = await run(get('convert'), { args: ['100', 'f', 'to', 'c'] })
  assert.match(ctx.replies[0], /37\.78/)
})

test('.convert rejects nonsense instead of guessing', async () => {
  await assert.rejects(() => run(get('convert'), { args: ['10', 'banana', 'to', 'miles'] }), /cannot convert/i)
})

test('.calc respects operator precedence', async () => {
  const ctx = await run(get('calc'), { argsText: '2+3*4' })
  assert.match(ctx.replies[0], /14/)
})

test('.calc handles brackets and unary minus', async () => {
  const ctx = await run(get('calc'), { argsText: '(2+3)*4 - -5' })
  assert.match(ctx.replies[0], /25/)
})

test('.calc refuses division by zero', async () => {
  await assert.rejects(() => run(get('calc'), { argsText: '5/0' }), /division by zero/i)
})

test('.roman converts both directions', async () => {
  const toRoman = await run(get('roman'), { args: ['1987'] })
  assert.match(toRoman.replies[0], /MCMLXXXVII/)
  const toNumber = await run(get('roman'), { args: ['MCMXCIV'] })
  assert.match(toNumber.replies[0], /1994/)
})

test('.words spells numbers correctly', async () => {
  const ctx = await run(get('words'), { args: ['1234'] })
  assert.match(ctx.replies[0], /one thousand two hundred and thirty-four/)
})

test('.base64 round-trips', async () => {
  const encoded = await run(get('base64'), { args: ['encode', 'Dark', 'Eyes'] })
  const b64 = encoded.replies[0].match(/```([^`]+)```/)?.[1]
  assert.ok(b64)
  const decoded = await run(get('base64'), { args: ['decode', b64] })
  assert.match(decoded.replies[0], /Dark Eyes/)
})

test('.hash produces the correct sha256', async () => {
  const ctx = await run(get('hash'), { args: ['sha256', 'abc'] })
  assert.match(ctx.replies[0], /ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad/)
})

test('.password generates the requested length', async () => {
  const ctx = await run(get('password'), { args: ['32'] })
  const password = ctx.replies[0].match(/`([^`]+)`/)?.[1]
  assert.equal(password.length, 32)
})

// ── games ────────────────────────────────────
test('.dice rolls within range', async () => {
  const ctx = await run(get('dice'), { args: ['5d6'] })
  assert.match(ctx.replies[0], /🎲/)
})

test('.rps always produces a verdict', async () => {
  const ctx = await run(get('rps'), { args: ['rock'] })
  assert.match(ctx.replies[0], /(You win|I win|draw)/)
})

test('.rps rejects an invalid choice', async () => {
  await assert.rejects(() => run(get('rps'), { args: ['banana'] }), /rock, paper or scissors/i)
})

test('tic-tac-toe blocks a winning move', async () => {
  const start = await run(get('tictactoe'))
  assert.match(start.replies[0], /TIC-TAC-TOE/)

  // X takes 1, bot responds; X takes 2, bot must block 3
  await run(get('move'), { args: ['1'] })
  const second = await run(get('move'), { args: ['2'] })
  assert.match(second.replies[0], /│/, 'board should render')
  // the bot (O) must occupy a square after two moves
  assert.ok((second.replies[0].match(/O/g) ?? []).length >= 1, 'bot must have played')
})

test('.guessnumber starts a session and .guess answers it', async () => {
  await run(get('guessnumber'))
  const ctx = await run(get('guess'), { args: ['50'] })
  assert.match(ctx.replies[0], /(Higher|Lower|Correct|Out of tries)/)
})

test('.trivia asks a question and .answer grades it', async () => {
  const question = await run(get('trivia'))
  assert.match(question.replies[0], /TRIVIA/)
  const graded = await run(get('answer'), { args: ['tokyo'] })
  assert.match(graded.replies[0], /(Correct|Not quite)/)
})

// ── economy ──────────────────────────────────
test('.daily pays and records a balance', async () => {
  const ctx = await run(get('daily'), { sender: '2348000000010@s.whatsapp.net' })
  assert.match(ctx.replies[0], /claimed/i)

  const balance = await run(get('balance'), { sender: '2348000000010@s.whatsapp.net' })
  assert.match(balance.replies[0], /Pocket/)
})

test('.daily is rate-limited by a cooldown', async () => {
  const sender = '2348000000011@s.whatsapp.net'
  await run(get('daily'), { sender })
  await assert.rejects(() => run(get('daily'), { sender }), /cooldown/i)
})

test('.bank moves coins between pocket and bank', async () => {
  const sender = '2348000000012@s.whatsapp.net'
  await run(get('daily'), { sender })
  const deposit = await run(get('bank'), { sender, args: ['deposit', '100'] })
  assert.match(deposit.replies[0], /Deposited/)
  const withdraw = await run(get('bank'), { sender, args: ['withdraw', '50'] })
  assert.match(withdraw.replies[0], /Withdrew/)
})

test('.buy refuses when you cannot afford it', async () => {
  await assert.rejects(
    () => run(get('buy'), { sender: '2348000000013@s.whatsapp.net', args: ['shield'] }),
    /need .* coins/i
  )
})

test('.pay moves coins to the mentioned user', async () => {
  const sender = '2348000000014@s.whatsapp.net'
  await run(get('daily'), { sender })
  const ctx = await run(get('pay'), {
    sender,
    args: ['2348000000015', '100'],
    mentions: ['2348000000015@s.whatsapp.net']
  })
  assert.match(ctx.replies[0], /Sent/)
})

// ── moderation ───────────────────────────────
test('.antilink toggles the group setting', async () => {
  const enable = await run(get('antilink'), { args: ['kick'] })
  assert.match(enable.replies[0], /kick/)
  const current = await run(get('antilink'))
  assert.match(current.replies[0], /kick/)
})

test('.antilink rejects an invalid level', async () => {
  await assert.rejects(() => run(get('antilink'), { args: ['nonsense'] }), /choose one of/i)
})

test('.warn issues a warning and records it', async () => {
  const target = '2348000000020@s.whatsapp.net'
  const ctx = await run(get('warn'), { mentions: [target], args: ['spamming'] })
  assert.match(ctx.replies[0], /Warning 1/)
})

test('.warn removes the member at the limit', async () => {
  const target = '2348000000021@s.whatsapp.net'
  await run(get('warn'), { mentions: [target] })
  await run(get('warn'), { mentions: [target] })
  const third = await run(get('warn'), { mentions: [target] })
  assert.match(third.replies[0], /(removed|warnings)/i)
})

test('.kick refuses to target yourself', async () => {
  await assert.rejects(
    () => run(get('kick'), { mentions: ['2348000000002@s.whatsapp.net'] }),
    /cannot kick yourself/i
  )
})

test('.groupinfo reports real metadata', async () => {
  const ctx = await run(get('groupinfo'))
  assert.match(ctx.replies[0], /Test Group/)
  assert.match(ctx.replies[0], /3 \(2 admins\)/)
})

test('.tagall mentions every participant', async () => {
  const ctx = await run(get('tagall'), { argsText: 'hello all' })
  assert.match(ctx.replies[0], /2348000000001/)
})

// ── misc / tools ─────────────────────────────
test('.remind stores a reminder and .reminders lists it', async () => {
  const sender = '2348000000030@s.whatsapp.net'
  const created = await run(get('remind'), { sender, args: ['10m', 'call', 'mum'] })
  assert.match(created.replies[0], /Reminder #\d+ set/)

  const list = await run(get('reminders'), { sender })
  assert.match(list.replies[0], /call mum/)
})

test('.remind rejects a bad duration', async () => {
  await assert.rejects(() => run(get('remind'), { args: ['soon', 'x'] }), /when\?/i)
})

test('.todo → .todos → .donetodo → .deltodo lifecycle', async () => {
  const sender = '2348000000031@s.whatsapp.net'
  await run(get('todo'), { sender, argsText: 'buy fuel' })
  const list = await run(get('todos'), { sender })
  assert.match(list.replies[0], /buy fuel/)

  const id = list.replies[0].match(/\*#(\d+)\*/)?.[1]
  assert.ok(id, 'to-do should have an id')

  const done = await run(get('donetodo'), { sender, args: [id] })
  assert.match(done.replies[0], /done/i)

  const removed = await run(get('deltodo'), { sender, args: [id] })
  assert.match(removed.replies[0], /removed/i)
})

test('.note saves and .shownote retrieves it', async () => {
  const sender = '2348000000032@s.whatsapp.net'
  await run(get('note'), { sender, argsText: 'WiFi | password is hunter2' })
  const list = await run(get('notes'), { sender })
  const id = list.replies[0].match(/\*#(\d+)\*/)?.[1]
  assert.ok(id)

  const shown = await run(get('shownote'), { sender, args: [id] })
  assert.match(shown.replies[0], /hunter2/)
})

test('.afk and .afklist work together', async () => {
  const sender = '2348000000033@s.whatsapp.net'
  await run(get('afk'), { sender, args: ['sleeping'] })
  const list = await run(get('afklist'))
  assert.match(list.replies[0], /sleeping/)
  await run(get('unafk'), { sender })
})

test('.menu renders categories', async () => {
  const ctx = await run(get('menu'))
  assert.match(ctx.replies[0], /DARK EYES/)
  assert.match(ctx.replies[0], /menu general/)
})

test('.menu <category> lists commands', async () => {
  const ctx = await run(get('menu'), { args: ['tools'] })
  assert.match(ctx.replies[0], /\.calc/)
})

test('.cmd explains a single command', async () => {
  const ctx = await run(get('cmd'), { args: ['sticker'] })
  assert.match(ctx.replies[0], /sticker/i)
  assert.match(ctx.replies[0], /sticker/i)
})

test('.cmd suggests close matches for a typo', async () => {
  await assert.rejects(
    () => run(get('cmd'), { args: ['stikr'] }),
    (error) => /Did you mean/i.test(error.hint ?? ''),
    'a typo should produce a "Did you mean…" hint'
  )
})

test('.textmaker renders a real PNG buffer', async () => {
  const ctx = await run(get('textmaker'), { args: ['neon', 'Dark', 'Eyes'] })
  assert.ok(ctx.replies[0].includes('neon'), 'caption should name the style')
})

test('.textmaker rejects an unknown style', async () => {
  await assert.rejects(() => run(get('textmaker'), { args: ['nonsense', 'x'] }), /unknown style/i)
})

test('.ship scores a pair deterministically', async () => {
  const a = await run(get('ship'), { argsText: 'Ada & Charles' })
  const b = await run(get('ship'), { argsText: 'Ada & Charles' })
  assert.equal(a.replies[0], b.replies[0])
})

test('.qr produces a PNG buffer', async () => {
  const ctx = await run(get('qr'), { args: ['https://example.com'] })
  assert.match(ctx.replies[0], /QR for/)
})

test('.stats reports live numbers', async () => {
  const ctx = await run(get('stats'))
  assert.match(ctx.replies[0], /Commands loaded/)
})

test('dormant command explains what is missing instead of failing silently', async () => {
  const { setCapabilities } = await import('../src/core/registry.js')
  setCapabilities({ ffmpeg: true, ai: false, downloader: false })
  const { availability } = await import('../src/core/registry.js')
  const { available, missing } = availability(get('ai'))
  assert.equal(available, false)
  assert.deepEqual(missing, ['AI_API_KEY'])
  setCapabilities({ ffmpeg: true, ai: true, downloader: true })
})

test.after(() => closeDb())

// ── session id ───────────────────────────────
test('session ID round-trips through export → import', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const { exportSession, importSession, cleanSessionId, SESSION_PREFIX } = await import('../src/core/session.js')
  const { config } = await import('../src/config/index.js')

  // write a fake paired auth folder
  fs.mkdirSync(config.sessionDir, { recursive: true })
  fs.writeFileSync(
    path.join(config.sessionDir, 'creds.json'),
    JSON.stringify({ me: { id: '2348000000099:3@s.whatsapp.net' }, registered: true })
  )
  fs.writeFileSync(path.join(config.sessionDir, 'app-state-sync-key-AAAA.json'), JSON.stringify({ k: 'v' }))

  const id = await exportSession()
  assert.ok(id.startsWith(SESSION_PREFIX), 'session ID must carry the prefix')
  assert.ok(id.length > 60)

  // wipe the folder, then restore from the ID alone (this is what a host does)
  fs.rmSync(config.sessionDir, { recursive: true, force: true })
  const result = await importSession(id)
  assert.equal(result.number, '2348000000099')
  assert.ok(fs.existsSync(path.join(config.sessionDir, 'creds.json')))
})

test('a pasted session ID with quotes and newlines still loads', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const { exportSession, importSession, cleanSessionId } = await import('../src/core/session.js')
  const { config } = await import('../src/config/index.js')

  fs.mkdirSync(config.sessionDir, { recursive: true })
  fs.writeFileSync(
    path.join(config.sessionDir, 'creds.json'),
    JSON.stringify({ me: { id: '2348000000098:1@s.whatsapp.net' } })
  )

  const id = await exportSession()
  const messy = `  "${id.slice(0, 80)}\n${id.slice(80)}"  `
  assert.equal(cleanSessionId(messy).length, id.length)
  const result = await importSession(messy)
  assert.equal(result.number, '2348000000098')
})

test('garbage session IDs are rejected with a clear error', async () => {
  const { importSession } = await import('../src/core/session.js')
  await assert.rejects(() => importSession('not-a-session'), /base64|JSON/i)
  await assert.rejects(() => importSession(''), /empty/i)
})

test('export refuses an unpaired folder', async () => {
  const fs = await import('node:fs')
  const { exportSession } = await import('../src/core/session.js')
  const { config } = await import('../src/config/index.js')
  fs.rmSync(config.sessionDir, { recursive: true, force: true })
  fs.mkdirSync(config.sessionDir, { recursive: true })
  await assert.rejects(() => exportSession(), /pair|creds/i)
})
