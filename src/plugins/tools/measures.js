import { UserError } from '../../lib/errors.js'

/**
 * Unit converters that are genuinely computed — no API, no lookup tables of
 * answers, just factors. Every command accepts three shapes:
 *
 *   .length 10 km to miles
 *   .length 10 km miles
 *   .length 10km->miles
 */

/** Read the nth argument whether the caller supplied args[] or only argsText. */
const argAt = (ctx, index, fallback = '') => {
  if (Array.isArray(ctx.args) && ctx.args.length) return ctx.args[index] ?? fallback
  const parts = String(ctx.argsText ?? '').trim().split(/\s+/)
  return parts[index] ?? fallback
}

const TABLE = {
  length: {
    base: 'metre',
    units: {
      mm: 0.001, millimetre: 0.001, millimetres: 0.001, millimeter: 0.001, millimeters: 0.001,
      cm: 0.01, centimetre: 0.01, centimetres: 0.01, centimeter: 0.01, centimeters: 0.01,
      m: 1, metre: 1, metres: 1, meter: 1, meters: 1,
      km: 1000, kilometre: 1000, kilometres: 1000, kilometer: 1000, kilometers: 1000,
      in: 0.0254, inch: 0.0254, inches: 0.0254,
      ft: 0.3048, foot: 0.3048, feet: 0.3048,
      yd: 0.9144, yard: 0.9144, yards: 0.9144,
      mi: 1609.344, mile: 1609.344, miles: 1609.344,
      nmi: 1852, nauticalmile: 1852, nauticalmiles: 1852
    }
  },
  weight: {
    base: 'kilogram',
    units: {
      mg: 1e-6, milligram: 1e-6, milligrams: 1e-6,
      g: 0.001, gram: 0.001, grams: 0.001,
      kg: 1, kilogram: 1, kilograms: 1, kilo: 1, kilos: 1,
      t: 1000, tonne: 1000, tonnes: 1000, ton: 1000, tons: 1000,
      oz: 0.0283495, ounce: 0.0283495, ounces: 0.0283495,
      lb: 0.453592, lbs: 0.453592, pound: 0.453592, pounds: 0.453592,
      st: 6.35029, stone: 6.35029, stones: 6.35029
    }
  },
  speed: {
    base: 'metre/second',
    units: {
      ms: 1, 'm/s': 1, mps: 1,
      kmh: 1 / 3.6, 'km/h': 1 / 3.6, kph: 1 / 3.6,
      mph: 0.44704, mih: 0.44704,
      kn: 0.514444, knot: 0.514444, knots: 0.514444,
      fps: 0.3048, fts: 0.3048
    }
  },
  area: {
    base: 'square metre',
    units: {
      mm2: 1e-6, cm2: 1e-4, m2: 1, km2: 1e6,
      ha: 10000, hectare: 10000, hectares: 10000,
      ft2: 0.092903, sqft: 0.092903,
      yd2: 0.836127, sqyd: 0.836127,
      acre: 4046.86, acres: 4046.86,
      mi2: 2589988.11, sqmi: 2589988.11
    }
  },
  volume: {
    base: 'litre',
    units: {
      ml: 0.001, millilitre: 0.001, milliliters: 0.001,
      l: 1, litre: 1, litres: 1, liter: 1, liters: 1,
      m3: 1000, cm3: 0.001,
      tsp: 0.00492892, teaspoon: 0.00492892, teaspoons: 0.00492892,
      tbsp: 0.0147868, tablespoon: 0.0147868, tablespoons: 0.0147868,
      cup: 0.236588, cups: 0.236588,
      pt: 0.473176, pint: 0.473176, pints: 0.473176,
      qt: 0.946353, quart: 0.946353, quarts: 0.946353,
      gal: 3.78541, gallon: 3.78541, gallons: 3.78541
    }
  },
  time: {
    base: 'second',
    units: {
      ms: 0.001, millisecond: 0.001, milliseconds: 0.001,
      s: 1, sec: 1, second: 1, seconds: 1,
      min: 60, minute: 60, minutes: 60,
      h: 3600, hr: 3600, hour: 3600, hours: 3600,
      d: 86400, day: 86400, days: 86400,
      wk: 604800, week: 604800, weeks: 604800,
      mo: 2629800, month: 2629800, months: 2629800,
      y: 31557600, year: 31557600, years: 31557600
    }
  },
  data: {
    base: 'byte',
    units: {
      b: 1, byte: 1, bytes: 1,
      kb: 1024, kilobyte: 1024, kilobytes: 1024,
      mb: 1024 ** 2, megabyte: 1024 ** 2, megabytes: 1024 ** 2,
      gb: 1024 ** 3, gigabyte: 1024 ** 3, gigabytes: 1024 ** 3,
      tb: 1024 ** 4, terabyte: 1024 ** 4, terabytes: 1024 ** 4,
      kbit: 1024 / 8, mbit: (1024 ** 2) / 8, gbit: (1024 ** 3) / 8
    }
  }
}

/** Parse "10 km to miles", "10km->miles", or args ["10","km","to","miles"]. */
export function parseConversion(ctx) {
  const fromArgs = Array.isArray(ctx.args) ? ctx.args.join(' ').toLowerCase() : ''
  const raw = (fromArgs || ctx.argsText || '').toLowerCase().trim()
  const cleaned = raw.replace(/->|→|=| to | into /g, ' ').replace(/\s+/g, ' ').trim()
  const parts = cleaned.split(' ').filter(Boolean)

  let amount = null
  let rest = parts

  if (parts.length >= 2 && Number.isFinite(Number(parts[0]))) {
    amount = Number(parts[0])
    rest = parts.slice(1)
  } else {
    // handle "10km miles" written without a space
    const glued = /^(-?\d+(?:\.\d+)?)([a-z/]+)$/.exec(parts[0] ?? '')
    if (glued) {
      amount = Number(glued[1])
      rest = [glued[2], ...parts.slice(1)]
    }
  }

  if (amount === null || !Number.isFinite(amount)) throw new UserError('Start with a number, e.g. .length 10 km to miles')
  if (rest.length < 2) throw new UserError('Give me both units, e.g. .length 10 km to miles')

  return { amount, from: rest[0], to: rest[1] }
}

function convert(category, ctx) {
  const table = TABLE[category]
  const { amount, from, to } = parseConversion(ctx)

  const fromFactor = table.units[from]
  const toFactor = table.units[to]
  if (!fromFactor) throw new UserError(`I do not know the unit "${from}". Try one of: ${Object.keys(table.units).slice(0, 8).join(', ')}…`)
  if (!toFactor) throw new UserError(`I do not know the unit "${to}". Try one of: ${Object.keys(table.units).slice(0, 8).join(', ')}…`)

  const result = (amount * fromFactor) / toFactor
  const pretty = Number.isInteger(result) ? String(result) : result.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  return `${amount} ${from} = *${pretty} ${to}*`
}

const maker = (name, category, description, aliases = []) => ({
  name,
  aliases,
  category: 'tools',
  description,
  usage: `.${name} 10 km to miles`,
  cooldown: 1,
  async execute(ctx) {
    return ctx.reply(`📐 ${convert(category, ctx)}`)
  }
})

export default [
  maker('length', 'length', 'Convert lengths (mm, cm, m, km, in, ft, yd, mi, nmi)', ['len']),
  maker('weight', 'weight', 'Convert weights (mg, g, kg, t, oz, lb, st)', ['mass']),
  maker('speed-convert', 'speed', 'Convert speeds (m/s, km/h, mph, knots, ft/s)', ['speedc']),
  maker('area', 'area', 'Convert areas (m², km², ha, ft², acre, mi²)'),
  maker('volume', 'volume', 'Convert volumes (ml, l, tsp, tbsp, cup, pt, qt, gal)', ['vol']),
  maker('time-convert', 'time', 'Convert time spans (ms, s, min, h, d, wk, mo, y)', ['timec']),
  maker('data', 'data', 'Convert data sizes (B, KB, MB, GB, TB, kbit…)', ['datasize', 'bytes']),

  {
    name: 'base',
    aliases: ['radix', 'baseten'],
    category: 'tools',
    description: 'Convert a number between bases (2–36)',
    usage: '.base 255 10 16',
    cooldown: 1,
    async execute(ctx) {
      const value = String(argAt(ctx, 0))
      const from = Number.parseInt(argAt(ctx, 1, '10'), 10)
      const to = Number.parseInt(argAt(ctx, 2, '16'), 10)

      if (!value) throw new UserError('Usage: .base <number> <from base> <to base> — e.g. .base 255 10 16')
      for (const b of [from, to]) {
        if (!Number.isInteger(b) || b < 2 || b > 36) throw new UserError('Bases must be between 2 and 36.')
      }

      const parsed = Number.parseInt(value, from)
      if (!Number.isFinite(parsed)) throw new UserError(`"${value}" is not a valid base-${from} number.`)

      return ctx.reply(`🔢 ${value} (base ${from}) = *${parsed.toString(to).toUpperCase()}* (base ${to})\n_decimal: ${parsed}_`)
    }
  },

  {
    name: 'hex2dec',
    category: 'tools',
    description: 'Hexadecimal to decimal',
    usage: '.hex2dec ff',
    cooldown: 1,
    async execute(ctx) {
      const value = String(argAt(ctx, 0)).replace(/^0x/i, '')
      if (!/^[0-9a-f]+$/i.test(value)) throw new UserError('Give me a hexadecimal value, e.g. .hex2dec ff')
      return ctx.reply(`🔢 0x${value.toUpperCase()} = *${Number.parseInt(value, 16)}*`)
    }
  },

  {
    name: 'dec2hex',
    category: 'tools',
    description: 'Decimal to hexadecimal',
    usage: '.dec2hex 255',
    cooldown: 1,
    async execute(ctx) {
      const value = Number.parseInt(String(argAt(ctx, 0)), 10)
      if (!Number.isFinite(value)) throw new UserError('Give me a decimal number, e.g. .dec2hex 255')
      return ctx.reply(`🔢 ${value} = *0x${value.toString(16).toUpperCase()}*`)
    }
  },

  {
    name: 'decimal',
    aliases: ['bin2dec', 'dec2bin'],
    category: 'tools',
    description: 'Binary ↔ decimal (0/1 input is read as binary, anything else as decimal)',
    usage: '.decimal 1010',
    cooldown: 1,
    async execute(ctx) {
      const value = String(argAt(ctx, 0)).replace(/^0b/i, '')
      if (!value) throw new UserError('Give me a number, e.g. .decimal 1010')

      if (/^[01]+$/.test(value)) {
        const dec = Number.parseInt(value, 2)
        return ctx.reply(`🔢 0b${value} = *${dec}*\n_hex: 0x${dec.toString(16).toUpperCase()}_`)
      }
      const dec = Number.parseInt(value, 10)
      if (!Number.isFinite(dec)) throw new UserError(`"${value}" is neither binary nor decimal.`)
      return ctx.reply(`🔢 ${dec} = *0b${dec.toString(2)}*`)
    }
  },

  {
    name: 'octal',
    category: 'tools',
    description: 'Octal ↔ decimal (digits 0-7 are read as octal when they contain no 8 or 9)',
    usage: '.octal 755',
    cooldown: 1,
    async execute(ctx) {
      const value = String(argAt(ctx, 0))
      if (!value) throw new UserError('Give me a number, e.g. .octal 755')

      if (/^[0-7]+$/.test(value)) {
        const dec = Number.parseInt(value, 8)
        return ctx.reply(`🔢 0o${value} = *${dec}*\n_hex: 0x${dec.toString(16).toUpperCase()} · binary: 0b${dec.toString(2)}_`)
      }
      const dec = Number.parseInt(value, 10)
      if (!Number.isFinite(dec)) throw new UserError(`"${value}" is neither octal nor decimal.`)
      return ctx.reply(`🔢 ${dec} = *0o${dec.toString(8)}*`)
    }
  }
]
