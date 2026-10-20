import { fetchJson } from '../../lib/http.js'
import { UserError } from '../../lib/errors.js'
import { bold } from '../../lib/text.js'

const num = (value, label) => {
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n)) throw new UserError(`"${value}" is not a number${label ? ` for ${label}` : ''}.`)
  return n
}

/** Unit tables — every factor is exact against its base unit. */
const UNITS = {
  length: { base: 'm', m: 1, km: 1000, cm: 0.01, mm: 0.001, mile: 1609.344, yard: 0.9144, foot: 0.3048, inch: 0.0254, nmi: 1852 },
  mass: { base: 'kg', kg: 1, g: 0.001, mg: 0.000001, tonne: 1000, lb: 0.45359237, oz: 0.0283495231, stone: 6.35029318 },
  volume: { base: 'l', l: 1, ml: 0.001, gallon: 3.785411784, quart: 0.946352946, pint: 0.473176473, cup: 0.2365882365, floz: 0.0295735296 },
  area: { base: 'm2', m2: 1, km2: 1e6, cm2: 0.0001, hectare: 10000, acre: 4046.8564224, ft2: 0.09290304, mile2: 2589988.11 },
  data: { base: 'b', b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4, bit: 0.125 },
  speed: { base: 'mps', mps: 1, kph: 0.277777778, mph: 0.44704, knot: 0.514444444 }
}

const TEMP_UNITS = ['c', 'f', 'k']

/** Accept plurals: "miles" → "mile", "gallons" → "gallon". */
const ALIASES = { ft: 'foot', feet: 'foot', inches: 'inch', yards: 'yard', pounds: 'lb', lbs: 'lb', ounces: 'oz', stones: 'stone', hectares: 'hectare', knots: 'knot', bits: 'bit', bytes: 'b' }

function normalizeUnit(token = '') {
  const lower = token.replace('°', '').toLowerCase()
  if (ALIASES[lower]) return ALIASES[lower]
  if (lower.endsWith('s') && lower.length > 2) {
    const singular = lower.slice(0, -1)
    for (const table of Object.values(UNITS)) {
      if (table[singular] !== undefined) return singular
    }
    if (TEMP_UNITS.includes(singular)) return singular
  }
  return lower
}

function convertTemperature(value, from, to) {
  const f = from.toLowerCase()
  const t = to.toLowerCase()
  if (!TEMP_UNITS.includes(f) || !TEMP_UNITS.includes(t)) {
    throw new UserError('Temperature units are c, f or k.')
  }
  let celsius = value
  if (f === 'f') celsius = ((value - 32) * 5) / 9
  if (f === 'k') celsius = value - 273.15

  if (t === 'c') return celsius
  if (t === 'f') return (celsius * 9) / 5 + 32
  return celsius + 273.15
}

export default [
  {
    name: 'convert',
    aliases: ['unit', 'units', 'conv'],
    category: 'tools',
    description: 'Convert between units (length, mass, volume, area, data, speed, temperature)',
    usage: '.convert 10 km to miles',
    examples: ['.convert 100 f to c', '.convert 5 gb to mb', '.convert 3 lb to kg'],
    cooldown: 2,
    async execute(ctx) {
      const match = ctx.argsText.match(/^(-?[\d.]+)\s*([a-z0-9°]+)\s*(?:to|in|->|=)\s*([a-z0-9°]+)$/i)
      if (!match) {
        throw new UserError('Format: .convert <value> <from> to <to>', {
          hint: 'Examples: .convert 10 km to miles · .convert 100 f to c · .convert 5 gb to mb'
        })
      }

      const [, rawValue, rawFrom, rawTo] = match
      const value = num(rawValue)
      const from = normalizeUnit(rawFrom)
      const to = normalizeUnit(rawTo)

      // Temperature has its own maths
      if (TEMP_UNITS.includes(from) && TEMP_UNITS.includes(to)) {
        const result = convertTemperature(value, from, to)
        return ctx.reply(`🌡️ *${value}°${from.toUpperCase()}* = *${result.toFixed(2)}°${to.toUpperCase()}*`)
      }

      for (const [family, table] of Object.entries(UNITS)) {
        if (table[from] !== undefined && table[to] !== undefined) {
          const result = (value * table[from]) / table[to]
          const formatted = Math.abs(result) >= 0.001 ? Number(result.toPrecision(8)) : result.toExponential(4)
          return ctx.reply(`📐 *${value} ${from}* = *${formatted} ${to}*\n_(${family} conversion)_`)
        }
      }

      const all = Object.entries(UNITS).flatMap(([family, t]) => Object.keys(t).map((u) => `${u} (${family})`))
      throw new UserError(`I cannot convert ${from} → ${to}.`, {
        hint: `Known units include: ${all.slice(0, 24).join(', ')} …`
      })
    }
  },

  {
    name: 'currency',
    aliases: ['exchange', 'forex'],
    category: 'tools',
    description: 'Live currency conversion (free rate feed, no key)',
    usage: '.currency 100 USD NGN',
    examples: ['.currency 50 EUR GBP', '.currency 1 USD NGN'],
    cooldown: 5,
    async execute(ctx) {
      const [amountRaw = '1', fromRaw = 'USD', toRaw = 'NGN'] = ctx.args
      const amount = num(amountRaw)
      const from = fromRaw.toUpperCase()
      const to = toRaw.toUpperCase()

      const data = await fetchJson(`https://open.er-api.com/v6/latest/${from}`)
      if (data.result !== 'success') throw new UserError(`Unknown currency *${from}*.`)

      const rate = data.rates?.[to]
      if (!rate) throw new UserError(`Unknown currency *${to}*.`)

      const converted = amount * rate
      return ctx.reply(
        `💱 *${amount.toLocaleString()} ${from}* = *${converted.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${to}*\n\n` +
          `_Rate: 1 ${from} = ${rate.toFixed(6)} ${to}_\n` +
          `_Updated: ${new Date(data.time_last_update_unix * 1000).toUTCString()}_`
      )
    }
  },

  {
    name: 'crypto',
    aliases: ['cryptoprice', 'coinprice'],
    category: 'tools',
    description: 'Live crypto prices (CoinGecko, no key needed)',
    usage: '.crypto btc',
    examples: ['.crypto btc', '.crypto eth', '.crypto doge eur'],
    cooldown: 5,
    async execute(ctx) {
      const coin = (ctx.args[0] ?? 'bitcoin').toLowerCase()
      const vs = (ctx.args[1] ?? 'usd').toLowerCase()

      const aliases = { btc: 'bitcoin', eth: 'ethereum', doge: 'dogecoin', sol: 'solana', xrp: 'ripple', ada: 'cardano', bnb: 'binancecoin', trx: 'tron', shib: 'shiba-inu' }
      const id = aliases[coin] ?? coin

      const data = await fetchJson(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=${vs}&include_24hr_change=true`
      )
      const entry = data?.[id]
      if (!entry) throw new UserError(`I cannot find a coin called *${coin}*.`)

      const price = entry[vs]
      const change = entry[`${vs}_24h_change`]
      const arrow = change >= 0 ? '📈' : '📉'

      return ctx.reply(
        `${arrow} *${id.toUpperCase()}* — ${bold(`${price.toLocaleString()} ${vs.toUpperCase()}`)}\n` +
          `*24h change:* ${change?.toFixed(2)}%\n\n_CoinGecko live data_`
      )
    }
  },

  {
    name: 'base64',
    aliases: ['b64'],
    category: 'tools',
    description: 'Encode or decode Base64',
    usage: '.base64 encode <text> | .base64 decode <base64>',
    cooldown: 2,
    async execute(ctx) {
      const [action, ...rest] = ctx.args
      const text = rest.join(' ')
      if (!action || !text) throw new UserError('Use: .base64 encode <text> or .base64 decode <base64>')

      if (action === 'encode' || action === 'enc') {
        return ctx.reply(`🔐 \`\`\`${Buffer.from(text).toString('base64')}\`\`\``)
      }
      if (action === 'decode' || action === 'dec') {
        const decoded = Buffer.from(text, 'base64').toString('utf8')
        if (!decoded || /[\uFFFD]/.test(decoded)) throw new UserError('That is not valid Base64.')
        return ctx.reply(`🔓 \`\`\`${decoded}\`\`\``)
      }
      throw new UserError('Use *encode* or *decode*.')
    }
  },

  {
    name: 'binary',
    aliases: ['bin'],
    category: 'tools',
    description: 'Text ↔ binary',
    usage: '.binary encode hello',
    cooldown: 2,
    async execute(ctx) {
      const [action, ...rest] = ctx.args
      const text = rest.join(' ')
      if (!text) throw new UserError('Use: .binary encode <text> or .binary decode <01001000…>')

      if (action === 'encode' || action === 'enc') {
        const bin = [...text].map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ')
        return ctx.reply(`🤖 \`\`\`${bin}\`\`\``)
      }
      if (action === 'decode' || action === 'dec') {
        const clean = text.replace(/[^01]/g, '')
        if (clean.length % 8 !== 0) throw new UserError('Binary must be in groups of 8 bits.')
        const out = clean.match(/.{8}/g).map((b) => String.fromCharCode(parseInt(b, 2))).join('')
        return ctx.reply(`🤖 \`\`\`${out}\`\`\``)
      }
      throw new UserError('Use *encode* or *decode*.')
    }
  },

  {
    name: 'hex',
    category: 'tools',
    description: 'Text ↔ hexadecimal',
    usage: '.hex encode hello',
    cooldown: 2,
    async execute(ctx) {
      const [action, ...rest] = ctx.args
      const text = rest.join(' ')
      if (!text) throw new UserError('Use: .hex encode <text> or .hex decode <68656c6c6f>')

      if (action === 'encode' || action === 'enc') {
        return ctx.reply(`🔢 \`\`\`${Buffer.from(text).toString('hex')}\`\`\``)
      }
      if (action === 'decode' || action === 'dec') {
        const clean = text.replace(/[^0-9a-f]/gi, '')
        if (clean.length % 2) throw new UserError('Hex must have an even number of characters.')
        return ctx.reply(`🔢 \`\`\`${Buffer.from(clean, 'hex').toString('utf8')}\`\`\``)
      }
      throw new UserError('Use *encode* or *decode*.')
    }
  },

  {
    name: 'roman',
    aliases: ['romannumeral'],
    category: 'tools',
    description: 'Numbers ↔ Roman numerals (1–3999)',
    usage: '.roman 1987',
    cooldown: 2,
    async execute(ctx) {
      const input = ctx.args[0]
      if (!input) throw new UserError('Give me a number or a Roman numeral.')

      if (/^\d+$/.test(input)) {
        const n = Number(input)
        if (n < 1 || n > 3999) throw new UserError('Roman numerals cover 1–3999.')
        const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
        let remaining = n
        let out = ''
        for (const [value, symbol] of table) {
          while (remaining >= value) {
            out += symbol
            remaining -= value
          }
        }
        return ctx.reply(`🏛️ *${n}* = *${out}*`)
      }

      const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
      const upper = input.toUpperCase()
      if (!/^[IVXLCDM]+$/.test(upper)) throw new UserError('That is not a Roman numeral.')

      let total = 0
      for (let i = 0; i < upper.length; i++) {
        const current = values[upper[i]]
        const next = values[upper[i + 1]] ?? 0
        total += current < next ? -current : current
      }
      return ctx.reply(`🏛️ *${upper}* = *${total}*`)
    }
  },

  {
    name: 'words',
    aliases: ['number2words', 'towords'],
    category: 'tools',
    description: 'Turn a number into English words',
    usage: '.words 1234',
    cooldown: 2,
    async execute(ctx) {
      const n = Number.parseInt(ctx.args[0], 10)
      if (!Number.isFinite(n)) throw new UserError('Give me a number.')
      if (Math.abs(n) > 1e15) throw new UserError('That number is too big for me.')

      const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
      const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

      const under1000 = (value) => {
        let out = ''
        if (value >= 100) {
          out += `${ones[Math.floor(value / 100)]} hundred`
          value %= 100
          if (value) out += ' and '
        }
        if (value >= 20) {
          out += tens[Math.floor(value / 10)]
          if (value % 10) out += `-${ones[value % 10]}`
        } else if (value > 0) {
          out += ones[value]
        }
        return out
      }

      const scales = ['', ' thousand', ' million', ' billion', ' trillion']
      let remaining = Math.abs(n)
      const parts = []
      let scaleIndex = 0
      while (remaining > 0 && scaleIndex < scales.length) {
        const chunk = remaining % 1000
        if (chunk) parts.unshift(under1000(chunk) + scales[scaleIndex])
        remaining = Math.floor(remaining / 1000)
        scaleIndex++
      }
      const text = `${n < 0 ? 'minus ' : ''}${parts.join(' ') || 'zero'}`
      return ctx.reply(`🔤 *${n.toLocaleString()}*\n\n${text}`)
    }
  },

  {
    name: 'temperature',
    aliases: ['temp'],
    category: 'tools',
    description: 'Quick temperature conversion',
    usage: '.temp 100 f',
    cooldown: 2,
    async execute(ctx) {
      const [valueRaw, unit = 'c'] = ctx.args
      const value = num(valueRaw, 'temperature')
      const from = unit.toLowerCase()
      const targets = TEMP_UNITS.filter((u) => u !== from)
      const lines = targets.map((t) => `${value}°${from.toUpperCase()} = *${convertTemperature(value, from, t).toFixed(1)}°${t.toUpperCase()}*`)
      return ctx.reply(`🌡️ ${lines.join('\n')}`)
    }
  },

  {
    name: 'worldtime',
    aliases: ['timezone'],
    category: 'tools',
    description: 'Current time in any city timezone',
    usage: '.worldtime Africa/Lagos',
    examples: ['.worldtime Europe/London', '.worldtime America/New_York'],
    cooldown: 3,
    async execute(ctx) {
      const zone = ctx.args[0] || 'Africa/Lagos'
      try {
        const formatted = new Intl.DateTimeFormat('en-GB', {
          timeZone: zone,
          dateStyle: 'full',
          timeStyle: 'short'
        }).format(new Date())
        return ctx.reply(`🌍 *${zone}*\n\n${formatted}`)
      } catch {
        throw new UserError(`Unknown timezone *${zone}*.`, {
          hint: 'Use a name like Africa/Lagos, Europe/London, Asia/Tokyo.'
        })
      }
    }
  }
]
