import { UserError } from '../../lib/errors.js'

/**
 * Knowledge commands — Wikipedia, Urban Dictionary, Datamuse, DuckDuckGo,
 * country facts, GitHub and live earthquake data. Everything is fetched from a
 * real public API at call time (see src/services/lookup.js for the endpoint map).
 */

const trim = (text, max = 900) => {
  const t = String(text ?? '').trim()
  return t.length <= max ? t : `${t.slice(0, max).trimEnd()}…`
}

const need = (ctx, hint) => {
  const term = (ctx.argsText ?? '').trim()
  if (!term) throw new UserError(hint)
  return term
}

export default [
  {
    name: 'wikipedia',
    aliases: ['wiki', 'w'],
    category: 'tools',
    description: 'Wikipedia summary for a topic',
    usage: '.wiki Nigeria',
    cooldown: 3,
    async execute(ctx) {
      const term = need(ctx, 'What should I look up? e.g. .wiki Chinua Achebe')
      const page = await ctx.services.lookup.wikipedia(term)
      if (!page) throw new UserError(`No Wikipedia page matched "${term}".`)

      const body = [`📖 *${page.title}*`]
      if (page.description) body.push(`_${page.description}_`)
      body.push('', trim(page.extract))
      body.push('', `🔗 ${page.url}`, `_source: ${page.source}_`)

      if (page.thumbnail && ctx.sock) {
        return ctx.sock.sendMessage(ctx.chat, { image: { url: page.thumbnail }, caption: body.join('\n') })
      }
      return ctx.reply(body.join('\n'))
    }
  },

  {
    name: 'wikisearch',
    aliases: ['wikis', 'wikiarticles'],
    category: 'tools',
    description: 'Search Wikipedia and list matching articles',
    usage: '.wikisearch lagos history',
    cooldown: 3,
    async execute(ctx) {
      const term = need(ctx, 'What should I search? e.g. .wikisearch lagos history')
      const results = await ctx.services.lookup.wikiResults(term, 6)
      if (!results.length) throw new UserError(`Nothing on Wikipedia for "${term}".`)

      const list = results.map((r, i) => `${i + 1}. *${r.title}*\n   ${trim(r.snippet, 120)}`).join('\n')
      return ctx.reply(`🔎 *Wikipedia: "${term}"*\n\n${list}\n\n_Open with .wiki <title>._`)
    }
  },

  {
    name: 'wikiquote',
    aliases: ['wquote'],
    category: 'tools',
    description: 'Wikiquote summary for a person or topic',
    usage: '.wikiquote Wole Soyinka',
    cooldown: 3,
    async execute(ctx) {
      const term = need(ctx, 'Who or what should I look up? e.g. .wikiquote Wole Soyinka')
      const page = await ctx.services.lookup.wikiquote(term)
      if (!page) throw new UserError(`No Wikiquote page for "${term}".`)
      return ctx.reply(`❝ *${page.title}*\n\n${trim(page.extract)}\n\n🔗 ${page.url}\n_source: ${page.source}_`)
    }
  },

  {
    name: 'urban',
    aliases: ['urbandict', 'slang', 'ud'],
    category: 'tools',
    description: 'Urban Dictionary definition',
    usage: '.urban no cap',
    cooldown: 3,
    async execute(ctx) {
      const term = need(ctx, 'Which word or phrase? e.g. .urban no cap')
      const entry = await ctx.services.lookup.urban(term)
      if (!entry) throw new UserError(`Urban Dictionary has nothing for "${term}".`)

      const lines = [`📚 *${entry.word}*`, '', trim(entry.definition, 700)]
      if (entry.example) lines.push('', `_Example:_ ${trim(entry.example, 300)}`)
      lines.push('', `👍 ${entry.thumbsUp} · 👎 ${entry.thumbsDown} — by ${entry.author}`, `_source: ${entry.source}_`)
      return ctx.reply(lines.join('\n'))
    }
  },

  {
    name: 'synonym',
    aliases: ['syn'],
    category: 'tools',
    description: 'Synonyms for a word (Datamuse)',
    usage: '.synonym happy',
    cooldown: 2,
    async execute(ctx) {
      const word = need(ctx, 'Which word? e.g. .synonym happy')
      const words = await ctx.services.lookup.related(word, 'syn', 15)
      if (!words.length) throw new UserError(`No synonyms found for "${word}".`)
      return ctx.reply(`🔁 *Synonyms for "${word}"*\n\n${words.join(' · ')}\n\n_source: datamuse.com_`)
    }
  },

  {
    name: 'antonym',
    aliases: ['ant'],
    category: 'tools',
    description: 'Antonyms for a word (Datamuse)',
    usage: '.antonym happy',
    cooldown: 2,
    async execute(ctx) {
      const word = need(ctx, 'Which word? e.g. .antonym happy')
      const words = await ctx.services.lookup.related(word, 'ant', 15)
      if (!words.length) throw new UserError(`No antonyms found for "${word}".`)
      return ctx.reply(`↔️ *Antonyms for "${word}"*\n\n${words.join(' · ')}\n\n_source: datamuse.com_`)
    }
  },

  {
    name: 'rhyme',
    aliases: ['rhymes'],
    category: 'tools',
    description: 'Words that rhyme (Datamuse)',
    usage: '.rhyme time',
    cooldown: 2,
    async execute(ctx) {
      const word = need(ctx, 'Which word? e.g. .rhyme time')
      const words = await ctx.services.lookup.related(word, 'rhy', 15)
      if (!words.length) throw new UserError(`No rhymes found for "${word}".`)
      return ctx.reply(`🎵 *Rhymes with "${word}"*\n\n${words.join(' · ')}\n\n_source: datamuse.com_`)
    }
  },

  {
    name: 'thesaurus',
    aliases: ['meanslike'],
    category: 'tools',
    description: 'Words with a similar meaning (Datamuse)',
    usage: '.thesaurus rain',
    cooldown: 2,
    async execute(ctx) {
      const word = need(ctx, 'Which word? e.g. .thesaurus rain')
      const words = await ctx.services.lookup.related(word, 'ml', 15)
      if (!words.length) throw new UserError(`Nothing similar found for "${word}".`)
      return ctx.reply(`📖 *"${word}" means something like*\n\n${words.join(' · ')}\n\n_source: datamuse.com_`)
    }
  },

  {
    name: 'search',
    aliases: ['google', 'ddg', 'duckduckgo'],
    category: 'tools',
    description: 'Instant answer search (DuckDuckGo)',
    usage: '.search python programming',
    cooldown: 3,
    async execute(ctx) {
      const term = need(ctx, 'What should I search? e.g. .search python programming')
      const answer = await ctx.services.lookup.instantAnswer(term)

      const lines = [`🔎 *${term}*`]
      if (answer.heading) lines.push(`_${answer.heading}_`)
      if (answer.answer) lines.push('', `✅ ${trim(answer.answer, 400)}`)
      if (answer.definition) lines.push('', trim(answer.definition, 400))
      if (answer.abstract) {
        lines.push('', trim(answer.abstract, 700))
        if (answer.source) lines.push(`_source: ${answer.source}_`)
      }
      if (answer.topics.length) {
        lines.push('', '*Related*')
        lines.push(...answer.topics.slice(0, 4).map((t) => `• ${trim(t.text, 140)}`))
      }
      if (answer.abstractUrl) lines.push('', `🔗 ${answer.abstractUrl}`)

      if (!answer.abstract && !answer.answer && !answer.definition && !answer.topics.length) {
        throw new UserError(`No instant answer for "${term}". Try .wiki ${term} for an article instead.`)
      }
      return ctx.reply(lines.join('\n'))
    }
  },

  {
    name: 'pronounce',
    aliases: ['phonetic', 'ipa'],
    category: 'tools',
    description: 'IPA pronunciation for a word (Wiktionary)',
    usage: '.pronounce hello',
    cooldown: 2,
    async execute(ctx) {
      const word = need(ctx, 'Which word? e.g. .pronounce hello')
      const info = await ctx.services.lookup.pronounce(word)
      if (!info || !info.phonetic) throw new UserError(`I could not find a pronunciation for "${word}".`)

      const lines = [`🗣️ *${info.word}*`, '', `*${info.phonetic}*`]
      if (info.alternates?.length) lines.push(`also: ${info.alternates.join(' · ')}`)
      if (info.meanings?.length) {
        lines.push('')
        for (const m of info.meanings) lines.push(`_${m.partOfSpeech}_: ${trim(m.definition, 160)}`)
      }
      lines.push('', `_source: ${info.source}_`)
      return ctx.reply(lines.join('\n'))
    }
  },

  {
    name: 'country',
    aliases: ['countryinfo'],
    category: 'tools',
    description: 'Capital, currency and population of a country',
    usage: '.country nigeria',
    cooldown: 2,
    async execute(ctx) {
      const term = need(ctx, 'Which country? e.g. .country nigeria')
      const c = await ctx.services.lookup.country(term)
      if (!c) throw new UserError(`I do not know a country called "${term}".`)

      const lines = [`🌍 *${c.name}*`]
      if (c.capital) lines.push(`🏛️ Capital: *${c.capital}*`)
      if (c.currency) lines.push(`💵 Currency: ${c.currency}`)
      if (c.population) lines.push(`👥 Population: ${Number(c.population).toLocaleString('en-US')}`)
      if (c.iso2) lines.push(`🏷️ ISO: ${c.iso2}${c.iso3 ? ` / ${c.iso3}` : ''}`)
      lines.push('', `_source: ${c.source}_`)

      if (c.flag) {
        return ctx.sock.sendMessage(ctx.chat, { image: { url: c.flag }, caption: lines.join('\n') })
      }
      return ctx.reply(lines.join('\n'))
    }
  },

  {
    name: 'github',
    aliases: ['gh', 'repoinfo'],
    category: 'tools',
    description: 'GitHub repository stats',
    usage: '.github Darkeye-devs/Darkeye_md_bots',
    cooldown: 3,
    async execute(ctx) {
      const target = need(ctx, 'Which repo? e.g. .github owner/repo')
      if (!target.includes('/')) throw new UserError('Use the owner/repo form, e.g. .github facebook/react')

      const repo = await ctx.services.lookup.github(target)
      if (!repo) throw new UserError(`GitHub has no repo called "${target}".`)

      const lines = [
        `🐙 *${repo.name}*`,
        repo.description ? `\n${repo.description}` : '',
        `\n⭐ ${repo.stars.toLocaleString('en-US')} · 🍴 ${repo.forks.toLocaleString('en-US')} · 🐛 ${repo.issues} open`,
        repo.language ? `💻 ${repo.language}` : '',
        repo.license ? `📜 ${repo.license}` : '',
        `📅 pushed ${new Date(repo.updated).toISOString().slice(0, 10)}`,
        repo.topics.length ? `🏷️ ${repo.topics.slice(0, 6).join(', ')}` : '',
        `\n🔗 ${repo.url}`
      ].filter(Boolean)
      return ctx.reply(lines.join('\n'))
    }
  },

  {
    name: 'earthquake',
    aliases: ['quake', 'quakes'],
    category: 'tools',
    description: 'Significant earthquakes this week (USGS)',
    cooldown: 10,
    async execute(ctx) {
      const list = await ctx.services.lookup.earthquakes()
      if (!list.length) return ctx.reply('🌍 No significant earthquakes recorded in the past week. Quiet planet.')

      const body = list
        .map((q) => {
          const when = new Date(q.time).toISOString().slice(0, 16).replace('T', ' ')
          return `• *M${q.magnitude ?? '?'}* — ${q.place ?? 'unknown'}${q.tsunami ? ' 🌊' : ''}\n  _${when} UTC_`
        })
        .join('\n')
      return ctx.reply(`🌍 *Significant earthquakes (past 7 days)*\n\n${body}\n\n_source: earthquake.usgs.gov_`)
    }
  }
]
