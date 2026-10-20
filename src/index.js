#!/usr/bin/env node
import { config, validateConfig, ensureDirs, paths } from './config/index.js'
import { logger } from './core/logger.js'
import { loadPlugins, setCapabilities, registryStats, capabilities } from './core/registry.js'
import { connect, disconnect } from './core/client.js'
import { state } from './core/state.js'
import { initDb, closeDb } from './services/database.js'
import { ffmpegAvailable } from './services/sticker.js'
import * as scheduler from './services/scheduler.js'
import { startServer } from './web/server.js'
import { sessionExists } from './core/auth.js'
import { hydrateFromEnv, sessionFromEnv } from './core/session.js'
import { cleanupPairings } from './core/pairing.js'

const banner = `
  ██████╗  █████╗ ██████╗ ██╗  ██╗    ███████╗██╗   ██╗███████╗███████╗
  ██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝    ██╔════╝╚██╗ ██╔╝██╔════╝██╔════╝
  ██║  ██║███████║██████╔╝█████╔╝     █████╗   ╚████╔╝ █████╗  ███████╗
  ██║  ██║██╔══██║██╔══██╗██╔═██╗     ██╔══╝    ╚██╔╝  ██╔══╝  ╚════██║
  ██████╔╝██║  ██║██║  ██║██║  ██╗    ███████╗   ██║   ███████╗███████║
  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝   ╚═╝   ╚══════╝╚══════╝
                          t h e   e y e   t h a t   s e e s
`

async function main() {
  console.log(banner)

  ensureDirs()

  // ── configuration ──────────────────────────
  const { fatal, warnings } = validateConfig()
  for (const warning of warnings) logger.warn(warning)
  if (fatal.length) {
    for (const problem of fatal) logger.fatal(problem)
    process.exit(1)
  }

  // ── storage ────────────────────────────────
  initDb()

  // ── capabilities (drives the honest "dormant command" messages) ──
  const hasFfmpeg = await ffmpegAvailable()
  setCapabilities({
    ffmpeg: hasFfmpeg,
    ai: Boolean(config.ai.apiKey),
    downloader: Boolean(config.downloader.apiUrl)
  })
  logger.info(
    'capabilities → ffmpeg:%s ai:%s downloader:%s',
    capabilities.ffmpeg,
    capabilities.ai,
    capabilities.downloader
  )

  // ── plugins ────────────────────────────────
  await loadPlugins()
  const stats = registryStats()
  logger.info(
    'registry → %d commands, %d aliases, %d categories, %d failed',
    stats.commands,
    stats.aliases,
    stats.categories,
    stats.failed
  )

  // ── web panel ──────────────────────────────
  await startServer()

  // ── whatsapp connection ────────────────────
  // Hosts without a disk send SESSION_ID: rebuild the auth folder FIRST,
  // otherwise the boot check below thinks we are unpaired and never connects.
  if (sessionFromEnv()) {
    const hydration = await hydrateFromEnv()
    logger.info(
      'SESSION_ID %s%s',
      hydration.hydrated ? `restored → ${hydration.number}` : `not used (${hydration.reason})`,
      ''
    )
  }

  state.hasSession = await sessionExists()
  if (state.hasSession) {
    logger.info('existing session found — connecting…')
    await connect()
  } else {
    logger.info('no session yet — open http://localhost:%d and pair a number', config.port)
  }

  scheduler.start(state.sock)

  // drop abandoned public pairings every 10 minutes
  setInterval(cleanupPairings, 10 * 60_000).unref()

  // ── graceful shutdown ──────────────────────
  const shutdown = async (signal) => {
    logger.info('%s received — shutting down', signal)
    scheduler.stop()
    await disconnect()
    closeDb()
    setTimeout(() => process.exit(0), 300)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled rejection'))
  process.on('uncaughtException', (error) => logger.error({ err: error }, 'uncaught exception'))
}

main().catch((error) => {
  logger.fatal({ err: error }, 'boot failed')
  process.exit(1)
})
