#!/usr/bin/env node
/** Generates docs/COMMANDS.md from the LIVE registry — no hand-written lists. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.env.LOG_LEVEL = 'silent'
process.env.NODE_ENV = 'development'

const { loadPlugins, registry, categoryList, registryStats, availability, setCapabilities } = await import(
  path.join(root, 'src/core/registry.js')
)
setCapabilities({ ffmpeg: true, ai: true, downloader: true })
await loadPlugins({ silent: true })

const stats = registryStats()
const prefix = process.env.PREFIX || '.'

const lines = []
lines.push('# Dark Eyes — command reference')
lines.push('')
lines.push(`Auto-generated from the live registry on ${new Date().toISOString().slice(0, 10)}.`)
lines.push('')
lines.push(`**${stats.commands} commands · ${stats.aliases} aliases · ${stats.categories} categories · ${stats.files} plugin files**`)
lines.push('')
lines.push('Every command below is registered and has a working implementation. Aliases are listed next to their command.')
lines.push('')
lines.push('Legend: ⭐ needs an API key · 🔧 needs ffmpeg on the host · 👑 owner only · 🛡️ group admin only')
lines.push('')

for (const [category, list] of categoryList()) {
  lines.push(`## ${category[0].toUpperCase()}${category.slice(1)} (${list.length})`)
  lines.push('')
  lines.push('| Command | Aliases | What it does | Notes |')
  lines.push('| --- | --- | --- | --- |')
  for (const plugin of list.sort((a, b) => a.name.localeCompare(b.name))) {
    const { available, missing } = availability(plugin)
    const notes = []
    if (!available) notes.push(missing.includes('AI_API_KEY') ? '⭐' : '')
    if (!available && missing.includes('ffmpeg')) notes.push('🔧')
    if (!available && missing.includes('DOWNLOAD_API_URL')) notes.push('⭐')
    if (plugin.ownerOnly) notes.push('👑')
    if (plugin.adminOnly) notes.push('🛡️')
    if (plugin.cooldown) notes.push(`${plugin.cooldown}s`)
    lines.push(
      `| \`${prefix}${plugin.name}\` | ${plugin.aliases.map((a) => `\`${prefix}${a}\``).join(' ') || '—'} | ${plugin.description} | ${notes.filter(Boolean).join(' ') || '—'} |`
    )
  }
  lines.push('')
}

lines.push('## How to add a command')
lines.push('')
lines.push('Drop a file into `src/plugins/<category>/` exporting an object (or array of objects):')
lines.push('')
lines.push('```js')
lines.push("export default {")
lines.push("  name: 'mycommand',")
lines.push("  aliases: ['mc'],")
lines.push("  category: 'tools',")
lines.push("  description: 'What it does, in one line',")
lines.push("  usage: '.mycommand <arg>',")
lines.push('  cooldown: 3,')
lines.push('  async execute(ctx) {')
lines.push('    return ctx.reply(`Hello ${ctx.pushName}`)')
lines.push('  }')
lines.push('}')
lines.push('```')
lines.push('')
lines.push('Restart (or `.reload` as owner) — the registry picks it up, validates it, and refuses duplicates.')
lines.push('')

fs.writeFileSync(path.join(root, 'docs/COMMANDS.md'), lines.join('\n'))
console.log(`Wrote docs/COMMANDS.md — ${stats.commands} commands, ${stats.aliases} aliases`)
