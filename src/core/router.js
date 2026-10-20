import { config } from '../config/index.js'
import { registry, resolve, availability } from './registry.js'
import { buildContext, resolvePermissions } from './context.js'
import { runMiddleware } from './middleware.js'
import { state } from './state.js'
import { log } from './logger.js'
import { friendlify, UserError } from '../lib/errors.js'
import { parseArgs } from '../lib/text.js'
import { stats } from '../services/database.js'

const logger = log('router')

/**
 * Detect a command in a message.
 * Supports `.ping`, `!ping`, `/ping`, and `ping` when noPrefix is allowed.
 * Returns null if the message is not a command.
 */
export function detectCommand(text) {
  if (!text) return null

  const prefixes = [config.prefix, '!', '/', '#'].filter(Boolean)
  for (const prefix of [...new Set(prefixes)]) {
    if (text.startsWith(prefix)) {
      const rest = text.slice(prefix.length).trim()
      if (!rest) return null
      const [rawCommand, ...tail] = rest.split(/\s+/)
      return {
        prefix,
        command: rawCommand.toLowerCase(),
        argsText: tail.join(' ').trim()
      }
    }
  }

  // Wordless invocation for plugins that opt out of a prefix
  const [first, ...tail] = text.split(/\s+/)
  const candidate = first?.toLowerCase()
  if (candidate && registry.commands.get(candidate)?.noPrefix) {
    return { prefix: '', command: candidate, argsText: tail.join(' ').trim() }
  }
  return null
}

/**
 * Run a plugin for a parsed message.
 * @param {object} params
 * @param {import('@whiskeysockets/baileys').WASocket} params.sock
 * @param {object} params.m parsed message (lib/parse.js)
 * @param {object} params.services service bucket
 */
export async function route({ sock, m, services }) {
  const detected = detectCommand(m.text)
  if (!detected) return { handled: false }

  const plugin = resolve(detected.command)
  if (!plugin) return { handled: false, unknownCommand: detected.command }

  const args = parseArgs(detected.argsText)

  const ctx = buildContext({
    sock,
    m,
    plugin,
    command: detected.command,
    args,
    argsText: detected.argsText,
    prefix: detected.prefix,
    text: m.text,
    services
  })

  await resolvePermissions(ctx)

  const started = Date.now()
  const guard = runMiddleware(ctx)

  if (!guard.ok) {
    if (!guard.silent && guard.reply) await ctx.reply(guard.reply).catch(() => {})
    return { handled: true, plugin: plugin.name, blocked: true, reason: guard.reply ? 'guard' : 'silent' }
  }

  try {
    state.commandsHandled += 1
    stats.bumpCommand(plugin.name)
    if (m.sender) {
      services.db.users.touch(m.sender, m.pushName)
      services.db.users.bumpCommands(m.sender)
    }
    await plugin.execute(ctx)
    logger.info('%s used by %s in %s (%dms)', plugin.name, m.senderNumber, m.chat, Date.now() - started)
    return { handled: true, plugin: plugin.name }
  } catch (error) {
    const friendly = friendlify(error)
    if (error instanceof UserError) {
      logger.warn('%s raised a user error: %s', plugin.name, error.message)
    } else {
      logger.error({ err: error }, '%s crashed', plugin.name)
    }
    await ctx.reply(`⚠️ ${friendly}`).catch(() => {})
    return { handled: true, plugin: plugin.name, error: error.message }
  }
}

/** Used by .help when a command name is wrong: suggest the closest match. */
export function suggestCommands(input = '', limit = 3) {
  const names = [...registry.commands.keys(), ...registry.aliases.keys()]
  const target = input.toLowerCase()
  const scored = names
    .map((name) => {
      const distance = levenshtein(target, name)
      return { name, distance }
    })
    .filter((x) => x.distance <= Math.max(2, Math.floor(target.length / 2)))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
  return scored.map((s) => s.name)
}

function levenshtein(a, b) {
  if (a === b) return 0
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
  }
  return dp[a.length][b.length]
}

export { availability }
export default route
