import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { config, paths } from '../config/index.js'
import { log } from './logger.js'

const logger = log('registry')

/** @typedef {Object} Plugin */
export const REQUIRED_FIELDS = ['name', 'category', 'description', 'execute']

export const registry = {
  commands: new Map(),  // canonical name -> plugin
  aliases: new Map(),   // alias -> canonical name
  byCategory: new Map(),
  loaded: [],
  failed: [],
  loadedAt: null
}

export function validatePlugin(plugin, file) {
  const problems = []
  for (const field of REQUIRED_FIELDS) {
    if (!plugin?.[field]) problems.push(`missing "${field}"`)
  }
  if (plugin?.execute && typeof plugin.execute !== 'function') problems.push('"execute" is not a function')
  if (plugin?.name && !/^[a-z0-9][a-z0-9-]*$/.test(plugin.name)) {
    problems.push(`name "${plugin.name}" must be lowercase letters, digits and dashes`)
  }
  if (plugin?.aliases && !Array.isArray(plugin.aliases)) problems.push('"aliases" must be an array')
  if (problems.length) throw new Error(`${path.basename(file)} → ${problems.join(', ')}`)
  return true
}

/** Recursively import every .js file under src/plugins/ */
async function walk(dir) {
  const out = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.startsWith('_')) out.push(full)
  }
  return out
}

export async function loadPlugins({ silent = false } = {}) {
  registry.commands.clear()
  registry.aliases.clear()
  registry.byCategory.clear()
  registry.loaded = []
  registry.failed = []

  const files = (await walk(paths.plugins)).sort()

  for (const file of files) {
    const relative = path.relative(config.rootDir, file)
    try {
      const mod = await import(`${pathToFileURL(file).href}?v=${Date.now()}`)
      const exported = mod.default ?? mod.plugin
      const plugins = Array.isArray(exported) ? exported : [exported]

      for (const plugin of plugins) {
        validatePlugin(plugin, file)
        const name = plugin.name

        if (registry.commands.has(name)) {
          throw new Error(`duplicate command "${name}" (already defined in ${registry.commands.get(name).file})`)
        }
        if (registry.aliases.has(name)) {
          throw new Error(`command "${name}" collides with an alias of "${registry.aliases.get(name)}"`)
        }

        const entry = {
          ...plugin,
          file: relative,
          aliases: plugin.aliases ?? [],
          cooldown: plugin.cooldown ?? 0,
          hidden: Boolean(plugin.hidden),
          noPrefix: Boolean(plugin.noPrefix),
          requires: plugin.requires ?? {}
        }

        registry.commands.set(name, entry)
        for (const alias of entry.aliases) {
          if (registry.aliases.has(alias) || registry.commands.has(alias)) {
            throw new Error(`alias "${alias}" of "${name}" collides with an existing command`)
          }
          registry.aliases.set(alias, name)
        }

        const category = entry.category || 'uncategorized'
        if (!registry.byCategory.has(category)) registry.byCategory.set(category, [])
        registry.byCategory.get(category).push(entry)
        registry.loaded.push(entry)
      }
    } catch (error) {
      registry.failed.push({ file: relative, error: error.message })
      logger.error('plugin failed: %s → %s', relative, error.message)
      if (process.env.PLUGIN_STRICT === 'true') throw error
    }
  }

  registry.loadedAt = Date.now()
  if (!silent) {
    logger.info(
      'loaded %d commands (%d aliases) from %d files; %d failed',
      registry.commands.size,
      registry.aliases.size,
      files.length,
      registry.failed.length
    )
  }
  return registry
}

/** Resolve a typed command name (or alias) to its plugin. */
export function resolve(name = '') {
  const key = name.toLowerCase()
  if (registry.commands.has(key)) return registry.commands.get(key)
  const canonical = registry.aliases.get(key)
  return canonical ? registry.commands.get(canonical) : null
}

/** Everything shown in .menu — aliases are excluded, that's the point. */
export function visibleCommands() {
  return [...registry.commands.values()].filter((p) => !p.hidden)
}

export function categoryList() {
  return [...registry.byCategory.entries()]
    .map(([name, list]) => [name, list.filter((p) => !p.hidden)])
    .filter(([, list]) => list.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
}

/** Feature availability for this host: ffmpeg, API keys, etc. */
export const capabilities = {
  ffmpeg: false,
  ai: false,
  downloader: false
}

export function setCapabilities(caps) {
  Object.assign(capabilities, caps)
}

/** Does this plugin have everything it needs to actually run right now? */
export function availability(plugin) {
  const missing = []
  if (plugin.requires?.ai && !capabilities.ai) missing.push('AI_API_KEY')
  if (plugin.requires?.downloader && !capabilities.downloader) missing.push('DOWNLOAD_API_URL')
  if (plugin.requires?.ffmpeg && !capabilities.ffmpeg) missing.push('ffmpeg')
  return { available: missing.length === 0, missing }
}

export function registryStats() {
  const all = [...registry.commands.values()]
  return {
    commands: all.length,
    aliases: registry.aliases.size,
    files: new Set(all.map((p) => p.file)).size,
    failed: registry.failed.length,
    categories: registry.byCategory.size,
    hidden: all.filter((p) => p.hidden).length
  }
}

export default registry
