#!/usr/bin/env node
/**
 * Renders the README/social assets from hand-written SVG via sharp.
 * Text is real vector text (Orbitron/Inter/JetBrains Mono), not AI art,
 * so it stays crisp at any size.
 *
 *   node scripts/make-assets.js
 */
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'docs', 'assets')
await fs.mkdir(outDir, { recursive: true })

const TAGLINE = 'T H E\u00A0\u00A0\u00A0\u00A0\u00A0E Y E\u00A0\u00A0\u00A0\u00A0\u00A0T H A T\u00A0\u00A0\u00A0\u00A0\u00A0S E E S'

const C = {
  bg: '#06070b',
  bg2: '#0b0f16',
  violet: '#8b5cf6',
  cyan: '#22d3ee',
  pink: '#f472b6',
  text: '#e9edf7',
  muted: '#8b93a7'
}

/** The eye mark, reused across assets. */
function eyeMark({ cx, cy, r, id = 'mark' }) {
  const w = r * 2.6
  const h = r * 1.55
  return `
  <g>
    <path d="M ${cx - w / 2} ${cy} C ${cx - w / 2.6} ${cy - h / 2}, ${cx + w / 2.6} ${cy - h / 2}, ${cx + w / 2} ${cy}
             C ${cx + w / 2.6} ${cy + h / 2}, ${cx - w / 2.6} ${cy + h / 2}, ${cx - w / 2} ${cy} Z"
          fill="none" stroke="url(#${id}-iris)" stroke-width="${Math.max(2, r * 0.09)}" />
    <circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="#04060a" />
    <circle cx="${cx}" cy="${cy}" r="${r * 0.44}" fill="url(#${id}-iris)" opacity="0.9" />
    <circle cx="${cx}" cy="${cy}" r="${r * 0.22}" fill="#04060a" />
    <circle cx="${cx - r * 0.17}" cy="${cy - r * 0.2}" r="${r * 0.1}" fill="#f5f3ff" opacity="0.85" />
  </g>
  <defs>
    <linearGradient id="${id}-iris" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C.cyan}"/>
      <stop offset="55%" stop-color="${C.violet}"/>
      <stop offset="100%" stop-color="${C.pink}"/>
    </linearGradient>
  </defs>`
}

/** Shared backdrop: deep space, soft glows, faint grid, scanlines. */
function backdrop(w, h, id = 'bg') {
  const cols = Math.ceil(w / 40)
  const rows = Math.ceil(h / 40)
  let grid = ''
  for (let i = 0; i <= cols; i++) grid += `<line x1="${i * 40}" y1="0" x2="${i * 40}" y2="${h}" stroke="#ffffff" stroke-opacity="0.028" stroke-width="1"/>`
  for (let j = 0; j <= rows; j++) grid += `<line x1="0" y1="${j * 40}" x2="${w}" y2="${j * 40}" stroke="#ffffff" stroke-opacity="0.028" stroke-width="1"/>`

  return `
  <defs>
    <linearGradient id="${id}-base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C.bg2}"/>
      <stop offset="55%" stop-color="${C.bg}"/>
      <stop offset="100%" stop-color="#08050f"/>
    </linearGradient>
    <radialGradient id="${id}-v" cx="18%" cy="12%" r="62%">
      <stop offset="0%" stop-color="${C.violet}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${C.violet}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-c" cx="86%" cy="8%" r="60%">
      <stop offset="0%" stop-color="${C.cyan}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${C.cyan}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-p" cx="70%" cy="96%" r="55%">
      <stop offset="0%" stop-color="${C.pink}" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="${C.pink}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id}-word" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="42%" stop-color="#d8b4fe"/>
      <stop offset="72%" stop-color="${C.cyan}"/>
      <stop offset="100%" stop-color="${C.pink}"/>
    </linearGradient>
    <linearGradient id="${id}-rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.violet}" stop-opacity="0"/>
      <stop offset="45%" stop-color="${C.violet}" stop-opacity="0.85"/>
      <stop offset="75%" stop-color="${C.cyan}" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="${C.cyan}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${id}-base)"/>
  <rect width="${w}" height="${h}" fill="url(#${id}-v)"/>
  <rect width="${w}" height="${h}" fill="url(#${id}-c)"/>
  <rect width="${w}" height="${h}" fill="url(#${id}-p)"/>
  ${grid}`
}

// ── banner: 1280×420 ──────────────────────────
const W = 1280
const H = 420

const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${backdrop(W, H, 'b')}

  <!-- frame -->
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#ffffff" stroke-opacity="0.07"/>

  <!-- eye mark -->
  <g transform="translate(0,0)">
    ${eyeMark({ cx: 640, cy: 132, r: 54, id: 'b' })}
  </g>

  <!-- wordmark -->
  <text x="640" y="252" text-anchor="middle" font-family="Orbitron" font-weight="800"
        font-size="86" letter-spacing="18" fill="url(#b-word)">DARK EYES</text>

  <!-- tagline -->
  <text x="640" y="292" text-anchor="middle" font-family="Inter" font-weight="500"
        font-size="17" letter-spacing="7" fill="${C.muted}">${TAGLINE}</text>

  <rect x="400" y="316" width="480" height="1.5" fill="url(#b-rule)"/>

  <!-- proof line -->
  <text x="640" y="352" text-anchor="middle" font-family="JetBrains Mono" font-weight="500"
        font-size="17" fill="#c7d2fe">249 commands · 211 aliases · 81 tests · 0 fake features</text>

  <!-- corner chips -->
  <text x="34" y="52" font-family="JetBrains Mono" font-size="13" fill="${C.violet}" opacity="0.85">v1.0</text>
  <text x="${W - 34}" y="52" text-anchor="end" font-family="JetBrains Mono" font-size="13" fill="${C.cyan}" opacity="0.85">WHATSAPP MD</text>
  <text x="34" y="${H - 30}" font-family="JetBrains Mono" font-size="13" fill="${C.muted}" opacity="0.8">baileys · sqlite · node 20</text>
  <text x="${W - 34}" y="${H - 30}" text-anchor="end" font-family="JetBrains Mono" font-size="13" fill="${C.muted}" opacity="0.8">MIT</text>
</svg>`

// ── social / og image: 1200×630 ───────────────
const OW = 1200
const OH = 630
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="${OW}" height="${OH}" viewBox="0 0 ${OW} ${OH}">
  ${backdrop(OW, OH, 'o')}
  <rect x="1" y="1" width="${OW - 2}" height="${OH - 2}" fill="none" stroke="#ffffff" stroke-opacity="0.07"/>
  ${eyeMark({ cx: 600, cy: 214, r: 74, id: 'o' })}
  <text x="600" y="370" text-anchor="middle" font-family="Orbitron" font-weight="800"
        font-size="98" letter-spacing="20" fill="url(#o-word)">DARK EYES</text>
  <text x="600" y="418" text-anchor="middle" font-family="Inter" font-weight="500"
        font-size="20" letter-spacing="8" fill="${C.muted}">${TAGLINE}</text>
  <rect x="300" y="456" width="600" height="1.5" fill="url(#o-rule)"/>
  <text x="600" y="502" text-anchor="middle" font-family="Inter" font-weight="600"
        font-size="24" fill="#e9edf7">WhatsApp MD bot · 249 real commands · 2-value deploy</text>
  <text x="600" y="540" text-anchor="middle" font-family="JetBrains Mono" font-size="17" fill="${C.cyan}">SESSION_ID + OWNER_NUMBER → done</text>
</svg>`

// ── square logo: 512×512 ──────────────────────
const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  ${backdrop(512, 512, 'l')}
  <rect x="16" y="16" width="480" height="480" rx="104" fill="#0a0d14" fill-opacity="0.72"
        stroke="#ffffff" stroke-opacity="0.08"/>
  ${eyeMark({ cx: 256, cy: 236, r: 96, id: 'l' })}
  <text x="256" y="400" text-anchor="middle" font-family="Orbitron" font-weight="800"
        font-size="42" letter-spacing="9" fill="url(#l-word)">DARK EYES</text>
</svg>`

// ── thin section divider: 1280×8 ──────────────
const rule = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="8" viewBox="0 0 1280 8">
  <rect width="1280" height="8" fill="#06070b"/>
  <rect y="3" width="1280" height="1.6" fill="url(#r-rule)"/>
  <defs>
    <linearGradient id="r-rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0"/>
      <stop offset="30%" stop-color="#8b5cf6" stop-opacity="0.7"/>
      <stop offset="55%" stop-color="#22d3ee" stop-opacity="0.9"/>
      <stop offset="78%" stop-color="#f472b6" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#f472b6" stop-opacity="0"/>
    </linearGradient>
  </defs>
</svg>`

const jobs = [
  ['banner.png', banner, W, H],
  ['rule.png', rule, 1280, 8],
  ['og.png', og, OW, OH],
  ['logo.png', logo, 512, 512]
]

for (const [name, svg, w, h] of jobs) {
  const buf = await sharp(Buffer.from(svg), { density: 200 }).resize(w, h).png({ compressionLevel: 9 }).toBuffer()
  await fs.writeFile(path.join(outDir, name), buf)
  console.log(`✓ docs/assets/${name}  ${w}×${h}  ${(buf.length / 1024).toFixed(1)} KB`)
}
