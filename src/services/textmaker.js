import sharp from 'sharp'
import { UserError } from '../lib/errors.js'

/**
 * Text-to-image rendering done locally with SVG + sharp.
 * No external "textmaker" API, no API key, no rate limits — it just works.
 *
 * Every style below is a real SVG recipe, not an alias for the same picture.
 */

const WIDTH = 900
const HEIGHT = 400

const escapeXml = (s = '') =>
  String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))

/** Wrap text into lines that fit the canvas. */
function wrapLines(text, maxChars = 16) {
  const words = String(text).trim().split(/\s+/)
  const lines = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars && current) {
      lines.push(current.trim())
      current = word
    } else {
      current = `${current} ${word}`
    }
  }
  if (current.trim()) lines.push(current.trim())
  return lines.slice(0, 4)
}

const STYLES = {
  neon: {
    background: `<rect width="100%" height="100%" fill="#08060f"/>
      <ellipse cx="450" cy="200" rx="380" ry="120" fill="#7b2ff7" opacity="0.25"/>`,
    paint: (t, y) => `
      <text x="450" y="${y}" text-anchor="middle" font-family="Impact, sans-serif" font-size="86"
        fill="none" stroke="#a855f7" stroke-width="7" filter="url(#glow)">${t}</text>
      <text x="450" y="${y}" text-anchor="middle" font-family="Impact, sans-serif" font-size="86"
        fill="#f5d0fe">${t}</text>`,
    defs: `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
  },
  fire: {
    background: `<rect width="100%" height="100%" fill="#1a0500"/>
      <ellipse cx="450" cy="330" rx="420" ry="150" fill="#ff6b00" opacity="0.45"/>
      <ellipse cx="450" cy="360" rx="300" ry="90" fill="#ffbb00" opacity="0.5"/>`,
    paint: (t, y) => `
      <text x="450" y="${y}" text-anchor="middle" font-family="Impact, sans-serif" font-size="88"
        fill="url(#fire)" stroke="#3d0a00" stroke-width="3">${t}</text>`,
    defs: `<linearGradient id="fire" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff3b0"/><stop offset="45%" stop-color="#ffb700"/>
      <stop offset="100%" stop-color="#ff3d00"/></linearGradient>`
  },
  gold: {
    background: `<rect width="100%" height="100%" fill="#0b0f14"/>`,
    paint: (t, y) => `
      <text x="450" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="84"
        fill="url(#gold)" stroke="#6b4f00" stroke-width="1.5">${t}</text>`,
    defs: `<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff6c2"/><stop offset="40%" stop-color="#ffd700"/>
      <stop offset="70%" stop-color="#b8860b"/><stop offset="100%" stop-color="#fff6c2"/></linearGradient>`
  },
  matrix: {
    background: `<rect width="100%" height="100%" fill="#000"/>
      <rect width="100%" height="100%" fill="url(#grid)" opacity="0.5"/>`,
    paint: (t, y) => `
      <text x="450" y="${y}" text-anchor="middle" font-family="Courier New, monospace" font-size="76"
        fill="#00ff88" filter="url(#green)">${t}</text>`,
    defs: `<pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
        <text x="4" y="22" font-family="monospace" font-size="14" fill="#0f5">1</text></pattern>
      <filter id="green"><feGaussianBlur stdDeviation="4" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
  },
  glitch: {
    background: `<rect width="100%" height="100%" fill="#0a0a12"/>`,
    paint: (t, y) => `
      <text x="444" y="${y}" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="82" fill="#ff004c" opacity="0.85">${t}</text>
      <text x="456" y="${y}" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="82" fill="#00e5ff" opacity="0.85">${t}</text>
      <text x="450" y="${y}" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="82" fill="#ffffff">${t}</text>`,
    defs: ''
  },
  ice: {
    background: `<rect width="100%" height="100%" fill="#02121f"/>
      <ellipse cx="450" cy="120" rx="420" ry="130" fill="#38bdf8" opacity="0.25"/>`,
    paint: (t, y) => `
      <text x="450" y="${y}" text-anchor="middle" font-family="Trebuchet MS, sans-serif" font-size="84"
        fill="url(#ice)" stroke="#bae6fd" stroke-width="2">${t}</text>`,
    defs: `<linearGradient id="ice" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/><stop offset="50%" stop-color="#7dd3fc"/>
      <stop offset="100%" stop-color="#0369a1"/></linearGradient>`
  },
  blood: {
    background: `<rect width="100%" height="100%" fill="#0a0000"/>
      <path d="M0 330 Q220 270 450 330 T900 320 L900 400 L0 400Z" fill="#5c0000" opacity="0.8"/>`,
    paint: (t, y) => `
      <text x="450" y="${y}" text-anchor="middle" font-family="Impact, sans-serif" font-size="88"
        fill="#c1121f" stroke="#2b0000" stroke-width="4">${t}</text>`,
    defs: ''
  },
  holographic: {
    background: `<rect width="100%" height="100%" fill="#050510"/>`,
    paint: (t, y) => `
      <text x="450" y="${y}" text-anchor="middle" font-family="Verdana, sans-serif" font-size="78"
        fill="url(#holo)">${t}</text>`,
    defs: `<linearGradient id="holo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff9a9e"/><stop offset="30%" stop-color="#fad0c4"/>
      <stop offset="55%" stop-color="#a1c4fd"/><stop offset="80%" stop-color="#c2e9fb"/>
      <stop offset="100%" stop-color="#fbc2eb"/></linearGradient>`
  },
  comic: {
    background: `<rect width="100%" height="100%" fill="#ffe600"/>`,
    paint: (t, y) => `
      <text x="450" y="${y}" text-anchor="middle" font-family="Comic Sans MS, cursive" font-size="84"
        fill="#111" stroke="#fff" stroke-width="6" paint-order="stroke">${t}</text>`,
    defs: ''
  },
  paper: {
    background: `<rect width="100%" height="100%" fill="#f4ecd8"/>
      <rect width="100%" height="100%" fill="url(#dots)" opacity="0.35"/>`,
    paint: (t, y) => `
      <text x="450" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="80"
        fill="#2b2118">${t}</text>`,
    defs: `<pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#8a7f6a"/></pattern>`
  },
  chrome: {
    background: `<rect width="100%" height="100%" fill="#111318"/>`,
    paint: (t, y) => `
      <text x="450" y="${y}" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="86"
        fill="url(#chrome)" stroke="#3f4753" stroke-width="1">${t}</text>`,
    defs: `<linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/><stop offset="25%" stop-color="#9aa4b2"/>
      <stop offset="50%" stop-color="#2b313b"/><stop offset="75%" stop-color="#c7d0da"/>
      <stop offset="100%" stop-color="#ffffff"/></linearGradient>`
  },
  rainbow: {
    background: `<rect width="100%" height="100%" fill="#0a0a0a"/>`,
    paint: (t, y) => `
      <text x="450" y="${y}" text-anchor="middle" font-family="Verdana, sans-serif" font-size="80"
        fill="url(#rb)">${t}</text>`,
    defs: `<linearGradient id="rb" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ff0000"/><stop offset="20%" stop-color="#ff9900"/>
      <stop offset="40%" stop-color="#ffee00"/><stop offset="60%" stop-color="#00e676"/>
      <stop offset="80%" stop-color="#00b0ff"/><stop offset="100%" stop-color="#d500f9"/></linearGradient>`
  }
}

export const styleNames = Object.keys(STYLES)

/**
 * Render text into a PNG.
 * @param {string} text
 * @param {string} style  one of styleNames
 */
export async function render(text, style = 'neon') {
  const clean = String(text ?? '').trim()
  if (!clean) throw new UserError('Give me some text to render.', { hint: '.textmaker neon Dark Eyes' })
  if (clean.length > 120) throw new UserError('Keep it under 120 characters so it stays readable.')

  const recipe = STYLES[style] ?? STYLES.neon
  const lines = wrapLines(clean.toUpperCase(), clean.length > 12 ? 14 : 16)
  const fontSizeBase = lines.length > 2 ? 62 : 84
  const lineHeight = fontSizeBase * 1.15
  const startY = HEIGHT / 2 - ((lines.length - 1) * lineHeight) / 2 + fontSizeBase / 3

  const textSvg = lines
    .map((line, i) => recipe.paint(escapeXml(line), Math.round(startY + i * lineHeight)))
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <defs>${recipe.defs}</defs>
    ${recipe.background}
    ${textSvg}
  </svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}

export const styles = styleNames

export default { render, styles, styleNames }
