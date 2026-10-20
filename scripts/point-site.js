#!/usr/bin/env node
/**
 * Point the Vercel site at a backend, then redeploy it.
 *
 *   node scripts/point-site.js https://dark-eyes-pairing.onrender.com
 *   node scripts/point-site.js https://dark-eyes-pairing.onrender.com --no-deploy
 *
 * Steps:
 *   1. sanity-check that <url>/api/health answers (retries: free hosts cold-start)
 *   2. write landing/public/config.json so every visitor gets that backend
 *      without needing ?api=…
 *   3. rebuild the site and deploy it (needs VERCEL_TOKEN)
 *   4. print the exact CORS_ORIGINS value to paste into Render
 *
 * The URL is also checked for the two mistakes that actually happen: a trailing
 * slash, and pointing the site at itself.
 */

import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const argv = process.argv.slice(2)
const raw = argv.find((a) => !a.startsWith('--'))
const noDeploy = argv.includes('--no-deploy')
const site = (process.env.SITE_URL || 'https://dark-eyes-multiple08021016309-3260.vercel.app').replace(/\/+$/, '')

if (!raw) {
  console.error(`
Usage: node scripts/point-site.js <backend-url> [--no-deploy]

  <backend-url>  e.g. https://dark-eyes-pairing.onrender.com
                 (also accepts http:// for a local backend)

Options:
  --no-deploy    only update config.json + rebuild, skip the Vercel upload
`)
  process.exit(1)
}

let backend
try {
  const parsed = new URL(raw)
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol')
  backend = `${parsed.protocol}//${parsed.host}`
} catch {
  console.error(`❌ "${raw}" is not a URL. Expected something like https://dark-eyes-pairing.onrender.com`)
  process.exit(1)
}

if (backend.replace(/^https?:\/\//, '') === site.replace(/^https?:\/\//, '')) {
  console.error('❌ That is this site\'s own address — the backend must be the Render service, not Vercel.')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForHealth(url, attempts = 12) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const body = await res.json().catch(() => ({}))
        return { ok: true, body }
      }
      process.stdout.write(`\r⏳ health check: HTTP ${res.status} (attempt ${i}/${attempts})   `)
    } catch (error) {
      process.stdout.write(`\r⏳ health check: ${error.cause?.code || error.name} (attempt ${i}/${attempts})   `)
    }
    if (i < attempts) await sleep(7000)
  }
  console.log('')
  return { ok: false }
}

const health = await waitForHealth(backend)
if (!health.ok) {
  console.error(`
❌ ${backend}/api/health did not answer.

   • On Render's free plan the service sleeps — open the Render dashboard and
     hit the URL once, then run this again.
   • Check the service is a Web Service running "node src/index.js" with a
     health check path of /api/health.
`)
  process.exit(1)
}
console.log(`\n✅ backend is awake at ${backend}`)
if (health.body?.status && health.body.status !== 'disconnected') {
  console.log(`   ⚠️  this instance reports status "${health.body.status}" — a pairing server should be "disconnected".`)
}

// ── 2. write config.json ────────────────────────────────────────────────────
const configPath = resolve('landing/public/config.json')
const config = JSON.parse(await readFile(configPath, 'utf8'))
config.apiBaseUrl = backend
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`)
console.log(`✅ landing/public/config.json → ${backend}`)

if (noDeploy) {
  console.log('\nNext: cd landing && npm run build, then npm run deploy:vercel with VERCEL_TOKEN.')
  process.exit(0)
}

// ── 3. build + deploy ──────────────────────────────────────────────────────
const run = (cmd, args, opts = {}) =>
  new Promise((res, rej) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts })
    child.on('exit', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`))))
  })

console.log('\n📦 building the site…')
await run('npm', ['run', 'build'], { cwd: resolve('landing') })

if (!process.env.VERCEL_TOKEN) {
  console.log(`
⚠️  VERCEL_TOKEN is not set, so the upload was skipped.
    config.json is updated and built — run:
      VERCEL_TOKEN=… VERCEL_TEAM_ID=… npm run deploy:vercel
`)
  process.exit(0)
}

console.log('\n🚀 deploying to Vercel…')
await run('node', ['scripts/deploy-vercel.js'])

console.log(`
──────────────────────────────────────────────
Now paste this into Render → your service → Environment:

  CORS_ORIGINS = ${site}

Then open ${site} and pair a number. That is the link you hand out.
──────────────────────────────────────────────
`)
