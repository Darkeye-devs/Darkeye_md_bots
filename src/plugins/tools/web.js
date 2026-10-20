import QRCode from 'qrcode'
import { fetchJson } from '../../lib/http.js'
import { UserError } from '../../lib/errors.js'
import { bold } from '../../lib/text.js'

/**
 * Web tools. Every one of these hits a genuinely free, key-less endpoint,
 * so they work the moment the bot boots.
 */
export default [
  {
    name: 'qr',
    aliases: ['qrcode', 'qrgen'],
    category: 'tools',
    description: 'Turn any text or link into a QR code image',
    usage: '.qr https://example.com',
    cooldown: 3,
    async execute(ctx) {
      const text = ctx.argsText || ctx.quotedText
      if (!text) throw new UserError('Give me text or a link to encode.')
      if (text.length > 1200) throw new UserError('That is too long for a QR code.')

      const buffer = await QRCode.toBuffer(text, {
        type: 'png',
        width: 720,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#0b0f14ff', light: '#ffffffff' }
      })
      return ctx.replyMedia(buffer, 'image/png', `👁️ QR for:\n${text.slice(0, 80)}`)
    }
  },

  {
    name: 'ip',
    aliases: ['ipinfo', 'whoisip'],
    category: 'tools',
    description: 'Look up the location and network of an IP address',
    usage: '.ip 8.8.8.8',
    cooldown: 4,
    async execute(ctx) {
      const target = ctx.args[0]
      if (!target) throw new UserError('Give me an IP address. Example: .ip 8.8.8.8')

      const data = await fetchJson(`https://ipapi.co/${encodeURIComponent(target)}/json/`)
      if (data.error) throw new UserError(data.reason || 'That IP could not be resolved.')

      return ctx.reply(
        `🌐 *${data.ip}*\n\n` +
          `*City:* ${data.city ?? '—'}\n` +
          `*Region:* ${data.region ?? '—'}\n` +
          `*Country:* ${data.country_name ?? '—'} (${data.country_code ?? '—'})\n` +
          `*Postal:* ${data.postal ?? '—'}\n` +
          `*Timezone:* ${data.timezone ?? '—'}\n` +
          `*Coordinates:* ${data.latitude ?? '—'}, ${data.longitude ?? '—'}\n` +
          `*ISP:* ${data.org ?? '—'}\n` +
          `*ASN:* ${data.asn ?? '—'}`
      )
    }
  },

  {
    name: 'dns',
    aliases: ['dnslookup'],
    category: 'tools',
    description: 'Resolve DNS records for a domain',
    usage: '.dns google.com [type]',
    cooldown: 4,
    async execute(ctx) {
      const domain = ctx.args[0]
      if (!domain) throw new UserError('Give me a domain. Example: .dns google.com')
      const type = (ctx.args[1] ?? 'A').toUpperCase()

      const data = await fetchJson(
        `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`
      )
      const answers = data.Answer ?? []
      if (!answers.length) return ctx.reply(`No *${type}* records found for *${domain}*.`)

      const lines = answers.slice(0, 12).map((a) => `• ${a.type === 16 ? a.data.replace(/"/g, '') : a.data} _(TTL ${a.TTL})_`)
      return ctx.reply(`🔍 *${domain}* — ${type} records\n\n${lines.join('\n')}`)
    }
  },

  {
    name: 'whois',
    aliases: ['domain', 'domaininfo'],
    category: 'tools',
    description: 'Domain registration info via RDAP (the modern whois)',
    usage: '.whois example.com',
    cooldown: 6,
    async execute(ctx) {
      const domain = (ctx.args[0] ?? '').replace(/^https?:\/\//, '').split('/')[0]
      if (!domain.includes('.')) throw new UserError('Give me a domain. Example: .whois example.com')

      const data = await fetchJson(`https://rdap.org/domain/${encodeURIComponent(domain)}`)
      if (!data?.ldhName) throw new UserError('That domain could not be found in RDAP.')

      const events = (data.events ?? []).map((e) => `• ${e.eventAction}: ${new Date(e.eventDate).toDateString()}`)
      const nameservers = (data.nameservers ?? []).map((n) => `• ${n.ldhName?.toLowerCase()}`)
      const registrar = data.entities?.find((e) => e.roles?.includes('registrar'))
      const registrarName = registrar?.vcardArray?.[1]?.find((v) => v[0] === 'fn')?.[3]

      return ctx.reply(
        `🌍 *${data.ldhName.toUpperCase()}*\n\n` +
          (registrarName ? `*Registrar:* ${registrarName}\n` : '') +
          `*Status:* ${(data.status ?? []).join(', ') || '—'}\n\n` +
          (events.length ? `*Timeline:*\n${events.join('\n')}\n\n` : '') +
          (nameservers.length ? `*Nameservers:*\n${nameservers.join('\n')}` : '')
      )
    }
  },

  {
    name: 'weather',
    aliases: ['forecast', 'climate'],
    category: 'tools',
    description: 'Live weather and a 3-day forecast (Open-Meteo, no key)',
    usage: '.weather Lagos',
    cooldown: 5,
    async execute(ctx) {
      const place = ctx.argsText
      if (!place) throw new UserError('Which city? Example: .weather Lagos')

      const geo = await fetchJson(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`
      )
      const location = geo.results?.[0]
      if (!location) throw new UserError(`I could not find a place called *${place}*.`)

      const weather = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}` +
          `&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code` +
          `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
          `&timezone=auto&forecast_days=3`
      )

      const codeMap = {
        0: 'Clear sky ☀️', 1: 'Mainly clear 🌤️', 2: 'Partly cloudy ⛅', 3: 'Overcast ☁️',
        45: 'Fog 🌫️', 48: 'Rime fog 🌫️', 51: 'Light drizzle 🌦️', 53: 'Drizzle 🌦️', 55: 'Heavy drizzle 🌧️',
        61: 'Light rain 🌦️', 63: 'Rain 🌧️', 65: 'Heavy rain 🌧️', 71: 'Light snow 🌨️', 73: 'Snow 🌨️',
        80: 'Rain showers 🌦️', 81: 'Heavy showers 🌧️', 82: 'Violent showers ⛈️',
        95: 'Thunderstorm ⛈️', 96: 'Thunderstorm + hail ⛈️', 99: 'Severe thunderstorm ⛈️'
      }

      const current = weather.current
      const daily = weather.daily
      const days = daily.time
        .map(
          (date, i) =>
            `• *${new Date(date).toLocaleDateString('en-GB', { weekday: 'short' })}* ${Math.round(daily.temperature_2m_min[i])}°–${Math.round(daily.temperature_2m_max[i])}° ` +
            `· ${codeMap[daily.weather_code[i]] ?? '—'} · 💧${daily.precipitation_probability_max[i] ?? 0}%`
        )
        .join('\n')

      return ctx.reply(
        `🌍 *${location.name}*, ${location.country}\n\n` +
          `🌡️ *${Math.round(current.temperature_2m)}°C* — feels like ${Math.round(current.apparent_temperature)}°C\n` +
          `${codeMap[current.weather_code] ?? '—'}\n` +
          `💧 Humidity ${current.relative_humidity_2m}% · 💨 Wind ${current.wind_speed_10m} km/h\n\n` +
          `${bold('3-DAY FORECAST')}\n${days}\n\n_Open-Meteo live data_`
      )
    }
  },

  {
    name: 'define',
    aliases: ['dictionary', 'meaning', 'dict'],
    category: 'tools',
    description: 'Dictionary definition with real examples',
    usage: '.define serendipity',
    cooldown: 4,
    async execute(ctx) {
      const word = ctx.args[0]
      if (!word) throw new UserError('Which word? Example: .define serendipity')

      const data = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
      if (!Array.isArray(data)) throw new UserError(`I could not find a definition for *${word}*.`)

      const entry = data[0]
      const sections = entry.meanings.slice(0, 3).map((meaning) => {
        const defs = meaning.definitions
          .slice(0, 3)
          .map((d, i) => `${i + 1}. ${d.definition}${d.example ? `\n   _${d.example}_` : ''}`)
          .join('\n')
        return `*${meaning.partOfSpeech}*\n${defs}`
      })

      return ctx.reply(
        `📖 *${entry.word}*${entry.phonetic ? ` ${entry.phonetic}` : ''}\n\n${sections.join('\n\n')}`
      )
    }
  },

  {
    name: 'shorturl',
    aliases: ['shorten', 'tinyurl'],
    category: 'tools',
    description: 'Shorten a long link (is.gd, free, no key)',
    usage: '.shorturl https://example.com/very/long/path',
    cooldown: 4,
    async execute(ctx) {
      const url = ctx.args[0]
      if (!url?.startsWith('http')) throw new UserError('Give me a full link starting with http.')

      const data = await fetchJson(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`)
      if (data.errorcode) throw new UserError(data.errormessage || 'That link could not be shortened.')

      return ctx.reply(
        `🔗 *Short link:*\n${data.shorturl}\n\n_Original (${url.length} chars) → ${data.shorturl.length} chars_`
      )
    }
  },

  {
    name: 'langdetect',
    aliases: ['language', 'detectlang'],
    category: 'tools',
    description: 'Guess the language of a piece of text',
    cooldown: 3,
    async execute(ctx) {
      const text = ctx.argsText || ctx.quotedText
      if (!text) throw new UserError('Give me text to analyse.')

      const data = await fetchJson(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text.slice(0, 500))}`
      )
      const detected = data?.[2]
      const names = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian', yo: 'Yoruba', ig: 'Igbo', ha: 'Hausa', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese', ru: 'Russian', hi: 'Hindi', ko: 'Korean', tr: 'Turkish', nl: 'Dutch', sw: 'Swahili' }
      if (!detected) throw new UserError('I could not detect the language.')
      return ctx.reply(`🌐 *Detected:* ${names[detected] ?? detected} \`(${detected})\``)
    }
  },

  {
    name: 'translate',
    aliases: ['tr'],
    category: 'tools',
    description: 'Translate text (free endpoint; or your AI model if configured)',
    usage: '.translate fr Good morning',
    examples: ['.translate ig How are you?', '.translate es Where is the market?'],
    cooldown: 4,
    async execute(ctx) {
      const target = ctx.args[0]
      const text = ctx.args.slice(1).join(' ') || ctx.quotedText
      if (!target || !text) throw new UserError('Usage: .translate <language code> <text>', { hint: 'Example: .translate fr Good morning' })

      const data = await fetchJson(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`
      )
      const translated = (data?.[0] ?? []).map((chunk) => chunk[0]).filter(Boolean).join('')
      if (!translated) throw new UserError('Translation failed — check the language code.')

      return ctx.reply(`🌐 *${data?.[2] ?? 'auto'} → ${target}*\n\n${translated}`)
    }
  },

  {
    name: 'rates',
    aliases: ['exchangerates'],
    category: 'tools',
    description: 'Exchange rates for a base currency',
    usage: '.rates USD',
    cooldown: 6,
    async execute(ctx) {
      const base = (ctx.args[0] ?? 'USD').toUpperCase()
      const data = await fetchJson(`https://open.er-api.com/v6/latest/${base}`)
      if (data.result !== 'success') throw new UserError(`Unknown currency *${base}*.`)

      const watch = ['NGN', 'USD', 'EUR', 'GBP', 'GHS', 'KES', 'ZAR', 'JPY', 'CNY', 'INR', 'CAD', 'AED']
      const lines = watch
        .filter((code) => data.rates[code] && code !== base)
        .map((code) => `• 1 ${base} = *${data.rates[code].toLocaleString(undefined, { maximumFractionDigits: 4 })}* ${code}`)

      return ctx.reply(`💱 *Rates from ${base}*\n\n${lines.join('\n')}\n\n_Updated ${new Date(data.time_last_update_unix * 1000).toUTCString()}_`)
    }
  }
]
