import { categoryList, availability, registryStats } from '../core/registry.js'
import { CATEGORIES } from '../config/constants.js'
import { config } from '../config/index.js'
import { bold } from './text.js'
import { formatDuration } from './time.js'

/** Visual marker showing whether a command will actually run on this host. */
function marker(plugin) {
  const { available, missing } = availability(plugin)
  if (available) return ''
  return ` ⚠️`
}

/**
 * Full menu, grouped by category — only real, registered commands appear.
 * Aliases are never listed separately; they are shown inline after the command.
 */
export function renderMenu({ page = null, prefix = config.prefix } = {}) {
  const stats = registryStats()
  const categories = categoryList()

  const header =
    `╭──────────────────────────────╮\n` +
    `│  👁️  ${bold(config.botName.toUpperCase()).padEnd(22)}  │\n` +
    `│  ${`${stats.commands} commands · ${stats.aliases} aliases`.padEnd(27)}│\n` +
    `╰──────────────────────────────╯`

  if (page) {
    const entry = categories.find(([name]) => name.toLowerCase() === page.toLowerCase())
    if (!entry) return `${header}\n\nNo category called *${page}*.`
    const [name, list] = entry
    const meta = CATEGORIES[name] ?? CATEGORIES.uncategorized
    const lines = list
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((plugin) => `• ${prefix}${plugin.name}${plugin.aliases.length ? ` _(${plugin.aliases.join(', ')})_` : ''}${marker(plugin)}`)
    return `${header}\n\n${meta.icon} ${bold(meta.label)} — ${list.length}\n\n${lines.join('\n')}\n\n_⚠️ = needs a key/binary you have not configured_`
  }

  const body = categories
    .map(([name, list]) => {
      const meta = CATEGORIES[name] ?? CATEGORIES.uncategorized
      return `${meta.icon} ${bold(meta.label)} (${list.length})\n   ${prefix}menu ${name}`
    })
    .join('\n\n')

  return (
    `${header}\n\n${body}\n\n` +
    `_Tap a category: ${prefix}menu <name>_`
  )
}

/** Single command help card. */
export function renderCommandHelp(plugin, prefix = config.prefix) {
  const { available, missing } = availability(plugin)
  const lines = [
    `${bold(prefix + plugin.name)}${plugin.aliases.length ? ` _(${plugin.aliases.map((a) => prefix + a).join(', ')})_` : ''}`,
    plugin.description,
    plugin.usage ? `*Usage:* ${plugin.usage.replace(/\./g, prefix)}` : null,
    plugin.examples?.length ? `*Examples:*\n${plugin.examples.map((e) => `  ${e.replace(/^\./, prefix)}`).join('\n')}` : null,
    `*Category:* ${plugin.category}${plugin.cooldown ? ` · *Cooldown:* ${plugin.cooldown}s` : ''}`,
    plugin.ownerOnly ? '*Owner only*' : null,
    plugin.adminOnly ? '*Group admins only*' : null,
    plugin.botAdminOnly ? '*Bot must be admin*' : null,
    available ? null : `⚠️ *Dormant here* — missing: ${missing.join(', ')}`
  ].filter(Boolean)
  return lines.join('\n')
}

export function renderStats({ state, summary }) {
  const stats = registryStats()
  return [
    `╭──────────────────────────────╮`,
    `│  👁️  ${bold('DARK EYES — STATUS').padEnd(19)} │`,
    `╰──────────────────────────────╯`,
    ``,
    `*Uptime:* ${formatDuration(Date.now() - state.startedAt)}`,
    `*Session:* ${state.connectedAt ? formatDuration(Date.now() - state.connectedAt) : 'not connected'}`,
    `*Messages seen:* ${state.messagesHandled}`,
    `*Commands run:* ${state.commandsHandled}`,
    `*Commands loaded:* ${stats.commands} (+${stats.aliases} aliases)`,
    `*Categories:* ${stats.categories}`,
    `*Failed plugins:* ${stats.failed}`,
    ``,
    `*Users:* ${summary?.users ?? 0}`,
    `*Groups:* ${summary?.groups ?? 0}`,
    `*Warnings issued:* ${summary?.warns ?? 0}`
  ].join('\n')
}
