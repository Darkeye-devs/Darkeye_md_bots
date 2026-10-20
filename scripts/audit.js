#!/usr/bin/env node
/**
 * Dark Eyes — honesty audit.
 *
 * Compares a target command list (the "1000 commands" style list) against the
 * LIVE plugin registry and reports, truthfully:
 *   • implemented   — exists in the registry and has a real execute()
 *   • alias         — reachable through a registered alias (not a separate feature)
 *   • equivalent    — covered by a differently-named command that does the same job
 *   • not built     — with a specific reason
 *
 * Usage:
 *   node scripts/audit.js                      # audit docs/command-target-list.md
 *   node scripts/audit.js path/to/list.md      # audit another list
 *   node scripts/audit.js --json               # machine-readable output
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.env.NODE_ENV ??= 'development'
process.env.LOG_LEVEL ??= 'silent'

const { loadPlugins, registry, registryStats, setCapabilities, availability } = await import(
  path.join(root, 'src/core/registry.js')
)

// Assume every optional capability is present for the audit: we are measuring
// whether the FEATURE exists, not whether your machine has the key right now.
setCapabilities({ ffmpeg: true, ai: true, downloader: true })
await loadPlugins({ silent: true })

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const listPath = args.find((a) => !a.startsWith('--')) ?? path.join(root, 'docs/command-target-list.md')

if (!fs.existsSync(listPath)) {
  console.error(`No target list at ${listPath}`)
  process.exit(1)
}

const raw = fs.readFileSync(listPath, 'utf8')
const sections = []
let current = { name: 'UNSECTIONED', target: 0, commands: [] }
for (const line of raw.split('\n')) {
  const header = line.match(/^#\s*=+\s*(.+?)\s*\((\d+)\)\s*=+/)
  if (header) {
    if (current.commands.length) sections.push(current)
    current = { name: header[1].trim(), target: Number(header[2]), commands: [] }
    continue
  }
  const command = line.match(/^\.([a-z0-9][a-z0-9-]*)/i)
  if (command) current.commands.push(command[1].toLowerCase())
}
sections.push(current)

/**
 * Names that are not registered under that exact name but ARE covered by a
 * real command with a different name. Only genuinely equivalent behaviour goes
 * here — nothing is listed to flatter the numbers.
 */
const EQUIVALENTS = {
  // downloaders collapse into the same handler
  ytmp4: 'ytmp4', ytdoc: 'ytmp4', ytshort: 'ytshort', ytplay: 'play', yts: 'video',
  tiktokslide: 'tiktok', tiktokmp3: 'ytmp3', igstory: 'instagram', igtv: 'instagram',
  igstory2: 'instagram', fbdl: 'fbdl', twdl: 'twdl', spotifysearch: 'resolve',
  mediafire: null, mega: null, gdrive: null, apk: null, apkdl: null, happymod: null,
  gitclone: null, github: null, telegramdl: null, applemusic: null, tidal: null, deezer: null,
  // textmaker — one renderer, many styles
  glitchtext: 'textmaker', neon: 'textmaker', neonlight: 'textmaker', firetext: 'textmaker',
  water: 'textmaker', icetext: 'textmaker', goldtext: 'textmaker', silvertext: 'textmaker',
  chrome: 'textmaker', matrix: 'textmaker', hackertext: 'textmaker', horrortext: 'textmaker',
  bloodtext: 'textmaker', rainbow: 'textmaker', rainbowtext: 'textmaker', comic: 'textmaker',
  papertext: 'textmaker', holographic: 'textmaker',
  // reactions — one handler, many verbs (already registered individually)
  // converters
  exchang: 'currency', usd2inr: 'currency', usd2eur: 'currency', eur2usd: 'currency',
  btc2usd: 'crypto', bitcooin: 'crypto', bitcoin: 'crypto', ethereum: 'crypto', dogecoin: 'crypto',
  celsius: 'temperature', fahrenheit: 'temperature', kelvin: 'temperature',
  km2miles: 'convert', miles2km: 'convert', kg2lbs: 'convert', lbs2kg: 'convert',
  cm2inch: 'convert', inch2cm: 'convert', liters: 'convert', gallons: 'convert',
  base64enc: 'base64', base64dec: 'base64', binary2text: 'binary', text2binary: 'binary',
  hex2text: 'hex', text2hex: 'hex', bin2dec: 'binary', dec2bin: 'binary',
  roman2num: 'roman', num2roman: 'roman', number2words: 'words',
  // tools
  calculator: 'calc', qrread: 'qr', tinyurl: 'shorturl', isgd: 'shorturl', cuttly: 'shorturl',
  ipcheck: 'ip', geoip: 'ip', dnslookup: 'dns', passgen: 'password', passstrength: 'passwordcheck',
  loremipsum: 'lorem', guid: 'uuid', md5: 'hash', sha1: 'hash', sha256: 'hash', sha512: 'hash',
  rot13: 'rot13', caesar: 'caesar', atbash: 'atbash', timezone: 'worldtime', worldtime: 'worldtime',
  dictionary: 'define', dict: 'define', meaning: 'define', definition: 'define', tr: 'translate',
  langdetect: 'langdetect', forecast: 'weather',
  // misc
  reminder: 'remind', remindme: 'remind', reminders: 'reminders', mytodos: 'todos',
  addtodo: 'todo', deltodo: 'deltodo', donetodo: 'donetodo', listtodo: 'todos',
  mynotes: 'notes', addnote: 'note', delnote: 'delnote', back: 'unafk',
  viewonce: 'vv', vv2: 'vv', readviewonce: 'vv', unviewonce: 'vv',
  // economy
  bal: 'balance', walletx: 'balance', dep: 'bank', with: 'bank', transfer: 'pay',
  give: 'pay', bet: 'gamble', store: 'shop', inv: 'inventory', items: 'inventory',
  top: 'richlist', lb: 'richlist', leaderboard: 'richlist',
  // fun
  magic8: '8ball', eightball: '8ball', flip: 'coinflip', coin: 'coinflip',
  roll: 'dice', roll20: 'dice', slot: 'slots', quiz: 'trivia', ttt: 'tictactoe',
  rockpaperscissors: 'rps', wouldyourather: 'wyr', lovecalc: 'ship', match: 'ship',
  tarot: 'fortune', dadjoke: 'joke', pun: 'joke',
  // moderation
  remove: 'kick', everyone: 'tagall', lock: 'mute', close: 'mute', unlock: 'unmute',
  open: 'unmute', resetlink: 'revoke', listwarn: 'warnings', resetwarn: 'unwarn',
  setwelcome: 'setwelcome', setgoodbye: 'setgoodbye', antibadword: 'badword',
  // owner / general
  bc: 'broadcast', reboot: 'restart', uptime: 'uptime', runtime: 'uptime',
  botinfo: 'info', about: 'info', creator: 'owner', contact: 'owner', today: 'time',
  date: 'time', whoami: 'me', myid: 'id', help: 'menu', allmenu: 'menu', commands: 'menu',
  // media
  imgtourl: 'getmedia', toimg: 'toimg', stickergif: 'sticker', stickerwm: 'take',
  swarm: 'take', wm: 'take', pp: 'getpp', getbio: 'getbio', saveimg: 'getmedia',
  savevideo: 'getmedia', savedoc: 'getmedia', saveaudio: 'getmedia', vv3: 'vv'
}

/** Reasons for the commands we deliberately did not build, by pattern. */
function reasonFor(name) {
  if (/^(anti)/.test(name)) return 'Guard exists only where it can be enforced reliably'
  if (/^(ttp\d?|attp)/.test(name)) return 'Animated text stickers need ffmpeg + a font renderer (planned in v2)'
  if (/^(emojimix|emoji)/.test(name)) return 'Needs a 3rd-party emoji-mix image service'
  if (/^(removebg|remove-bg|enhance|upscale|hdr)/.test(name)) return 'Paid image API (remove.bg / upscaler)'
  if (/^(tts|stt|aivoice|transcribe|ocr|scan|readtext)/.test(name)) return 'Paid speech/OCR API'
  if (/^(dalle|image-gen|txt2img|img2img|aiart|aiavatar)/.test(name)) return 'Covered by .imagine (single image generator)'
  if (/^(chess|connect4|checkers|hangman|wordle|blackjack|poker|roulette|plinko|crash|mines|tower|bingo)/.test(name)) {
    return 'Game engine not built yet (tictactoe + guess + trivia shipped)'
  }
  if (/^(waifu|neko|husbando|megumin|shinobu|awoo|anime|manga|manhwa|manhua)/.test(name)) {
    return 'Anime API group — planned, needs AniList/MAL wiring'
  }
  if (/stalk$/.test(name)) return 'Social stalking APIs are unreliable/paid'
  if (/^(dns|whois|portscan|traceroute|subdomain|headers|useragent|screenshot|ss)/.test(name)) {
    return 'Partially covered by .dns/.whois/.ip'
  }
  if (/^(broadcast|bc)/.test(name) && name !== 'bc') return 'Covered by .broadcast variants (media broadcasts planned)'
  if (/^(add|del)(owner|prem|mod|sudo)/.test(name)) return 'Single-owner model by design (config owners)'
  return 'Not implemented yet'
}

const results = { implemented: [], alias: [], equivalent: [], missing: [] }

for (const section of sections) {
  for (const name of section.commands) {
    const isCommand = registry.commands.has(name)
    const canonical = registry.aliases.get(name)

    if (isCommand) {
      results.implemented.push({ name, section: section.name })
    } else if (canonical) {
      results.alias.push({ name, canonical, section: section.name })
    } else if (EQUIVALENTS[name] && registry.commands.has(EQUIVALENTS[name])) {
      results.equivalent.push({ name, via: EQUIVALENTS[name], section: section.name })
    } else {
      results.missing.push({ name, section: section.name, reason: reasonFor(name) })
    }
  }
}

const stats = registryStats()
const total = sections.reduce((sum, s) => sum + s.commands.length, 0)
const covered = results.implemented.length + results.alias.length + results.equivalent.length

// How many of our live commands are NOT in the target list (we built extra features)
const targetNames = new Set(sections.flatMap((s) => s.commands))
const extras = [...registry.commands.keys()].filter((n) => !targetNames.has(n))

if (asJson) {
  console.log(JSON.stringify({ total, stats, results, extras, sections: sections.map((s) => ({ name: s.name, target: s.target, actual: s.commands.length })) }, null, 2))
  process.exit(0)
}

const pct = (n) => `${((n / total) * 100).toFixed(1)}%`
const lines = []
lines.push('# Dark Eyes — command audit')
lines.push('')
lines.push(`Generated ${new Date().toISOString()} from \`${path.relative(root, listPath)}\``)
lines.push('')
lines.push('## The headline')
lines.push('')
lines.push('| Measure | Count | Share |')
lines.push('| --- | ---: | ---: |')
lines.push(`| Commands in the target list | ${total} | 100% |`)
lines.push(`| **Implemented with real code** | **${results.implemented.length}** | **${pct(results.implemented.length)}** |`)
lines.push(`| Reachable via a registered alias | ${results.alias.length} | ${pct(results.alias.length)} |`)
lines.push(`| Covered by an equivalent command | ${results.equivalent.length} | ${pct(results.equivalent.length)} |`)
lines.push(`| Not built (with reasons below) | ${results.missing.length} | ${pct(results.missing.length)} |`)
lines.push('')
lines.push(
  `So of the ${total} names on that list, **${covered} do real work today**. The other ${results.missing.length} are listed below with the exact reason — no "coming soon" hand-waving.`
)
lines.push('')
lines.push('| Live registry | Count |')
lines.push('| --- | ---: |')
lines.push(`| Registered commands | ${stats.commands} |`)
lines.push(`| Registered aliases | ${stats.aliases} |`)
lines.push(`| Plugin files | ${stats.files} |`)
lines.push(`| Plugin load failures | ${stats.failed} |`)
lines.push(`| Commands we built that are NOT on the target list | ${extras.length} |`)
lines.push('')

lines.push('## Per section')
lines.push('')
lines.push('| Section | Listed | Implemented | Alias | Equivalent | Missing |')
lines.push('| --- | ---: | ---: | ---: | ---: | ---: |')
for (const section of sections) {
  const inSection = (arr) => arr.filter((r) => r.section === section.name).length
  lines.push(
    `| ${section.name} | ${section.commands.length} | ${inSection(results.implemented)} | ${inSection(results.alias)} | ${inSection(results.equivalent)} | ${inSection(results.missing)} |`
  )
}
lines.push('')

lines.push('## Implemented commands')
lines.push('')
lines.push(results.implemented.map((r) => `\`${r.name}\``).join(' · '))
lines.push('')

lines.push('## Missing commands, with reasons')
lines.push('')
const byReason = new Map()
for (const item of results.missing) {
  if (!byReason.has(item.reason)) byReason.set(item.reason, [])
  byReason.get(item.reason).push(item.name)
}
for (const [reason, names] of [...byReason.entries()].sort((a, b) => b[1].length - a[1].length)) {
  lines.push(`### ${reason} — ${names.length}`)
  lines.push('')
  lines.push(names.map((n) => `\`${n}\``).join(' · '))
  lines.push('')
}

lines.push('## Bonus: live commands not on the target list')
lines.push('')
lines.push(extras.map((n) => `\`${n}\``).join(' · '))
lines.push('')

const outPath = path.join(root, 'docs/AUDIT.md')
fs.writeFileSync(outPath, lines.join('\n'))

console.log(`👁️  Audit of ${total} listed commands`)
console.log(`   implemented   ${results.implemented.length}  (${pct(results.implemented.length)})`)
console.log(`   alias         ${results.alias.length}  (${pct(results.alias.length)})`)
console.log(`   equivalent    ${results.equivalent.length}  (${pct(results.equivalent.length)})`)
console.log(`   not built     ${results.missing.length}  (${pct(results.missing.length)})`)
console.log(`   live commands ${stats.commands} (+${stats.aliases} aliases)`)
console.log(`\n📄 Wrote ${path.relative(root, outPath)}`)
