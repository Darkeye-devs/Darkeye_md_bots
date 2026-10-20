import express from 'express'
import path from 'node:path'
import { config, paths } from '../config/index.js'
import { log } from '../core/logger.js'
import { state, snapshot } from '../core/state.js'
import { bus } from '../core/event-bus.js'
import { registryStats, capabilities } from '../core/registry.js'
import { summary } from '../services/database.js'
import { sessionExists, pairedNumber } from '../core/auth.js'
import { connect, disconnect } from '../core/client.js'
import { resetSession } from '../core/auth.js'
import { isValidPhone, sanitizePhone } from '../lib/jid.js'
import { panelAuth, requireToken } from './middleware/auth.js'

const logger = log('web')

export function createServer() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '256kb' }))

  // The panel is a single page; all API routes are small and JSON-only.
  app.use('/api', panelAuth)

  // ── health (used by docker healthcheck) ────
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, status: state.status, uptimeMs: Date.now() - state.startedAt })
  })

  // ── status snapshot ────────────────────────
  app.get('/api/status', (req, res) => {
    res.json({
      ...snapshot(),
      stats: safe(() => summary()),
      registry: registryStats(),
      capabilities: { ...capabilities },
      hasSession: state.hasSession ?? null
    })
  })

  // ── pairing: request a code ────────────────
  app.post('/api/pair', requireToken, async (req, res) => {
    const raw = req.body?.phone ?? ''
    const phone = sanitizePhone(raw)

    if (!isValidPhone(phone)) {
      return res.status(400).json({ ok: false, error: 'Enter your number with country code, digits only (e.g. 2348012345678).' })
    }
    if (state.status === 'connected') {
      return res.status(409).json({ ok: false, error: 'Already connected. Log out first if you want to re-pair.' })
    }
    if (state.pairingCode && Date.now() - (state.pairingRequestedAt ?? 0) < 20_000) {
      return res.status(429).json({ ok: false, error: 'A code was just issued — wait a few seconds before requesting another.' })
    }

    try {
      await connect({ phone, fresh: true })
      res.json({ ok: true, message: 'Pairing code requested. Check the panel for the code.' })
    } catch (error) {
      logger.error({ err: error }, 'pair request failed')
      res.status(500).json({ ok: false, error: 'Could not start pairing. Check the server logs.' })
    }
  })

  // ── pairing: connect by QR ─────────────────
  app.post('/api/qr', requireToken, async (req, res) => {
    if (state.status === 'connected') {
      return res.status(409).json({ ok: false, error: 'Already connected.' })
    }
    try {
      await connect({ fresh: true })
      res.json({ ok: true, message: 'Socket opened — the QR will appear here shortly.' })
    } catch (error) {
      res.status(500).json({ ok: false, error: 'Could not open a socket.' })
    }
  })

  // ── logout / reset ─────────────────────────
  app.post('/api/logout', requireToken, async (req, res) => {
    try {
      try {
        await state.sock?.logout()
      } catch {
        /* socket may be dead already */
      }
      await disconnect()
      await resetSession()
      res.json({ ok: true })
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  // ── live events (Server-Sent Events) ───────
  app.get('/api/events', (req, res) => {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no'
    })

    const send = (event, data) => {
      res.write(`event: ${event}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    send('status', snapshot())

    const onStatus = (payload) => send('status', { ...snapshot(), ...payload })
    const onQr = (payload) => send('qr', { dataUrl: payload.dataUrl })
    const onCode = (payload) => send('pairing-code', payload)
    const onError = (payload) => send('pairing-error', payload)
    const onDead = (payload) => send('session-dead', payload)

    bus.on('status', onStatus)
    bus.on('qr', onQr)
    bus.on('pairing-code', onCode)
    bus.on('pairing-error', onError)
    bus.on('session:dead', onDead)

    // keep-alive comment so proxies don't close the stream
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000)

    req.on('close', () => {
      clearInterval(ping)
      bus.off('status', onStatus)
      bus.off('qr', onQr)
      bus.off('pairing-code', onCode)
      bus.off('pairing-error', onError)
      bus.off('session:dead', onDead)
    })
  })

  // ── static panel ───────────────────────────
  app.use(express.static(paths.web, { extensions: ['html'], maxAge: '1h' }))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(paths.web, 'index.html'))
  })

  // ── error handler ──────────────────────────
  app.use((error, req, res, next) => {
    logger.error({ err: error }, 'web error')
    res.status(500).json({ ok: false, error: 'Internal error' })
  })

  return app
}

function safe(fn) {
  try {
    return fn()
  } catch {
    return null
  }
}

export function startServer() {
  return new Promise((resolve) => {
    const app = createServer()
    const server = app.listen(config.port, '0.0.0.0', () => {
      logger.info('pairing panel on http://localhost:%d', config.port)
      resolve(server)
    })
    server.on('error', (error) => {
      logger.error({ err: error }, 'failed to start the panel')
      resolve(null)
    })
  })
}

export default startServer
