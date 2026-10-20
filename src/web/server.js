import express from 'express'
import path from 'node:path'
import { config, paths } from '../config/index.js'
import { log } from '../core/logger.js'
import { state, snapshot } from '../core/state.js'
import { bus } from '../core/event-bus.js'
import { registryStats, capabilities } from '../core/registry.js'
import { summary } from '../services/database.js'
import { sessionExists, pairedNumber } from '../core/auth.js'
import { exportSession, importSession, sessionSummary } from '../core/session.js'
import {
  startPublicPairing,
  getPublicPairing,
  claimSession,
  startPublicQrPairing,
  readQrPairing,
  claimQrSession,
  rateLimited,
  cleanupPairings
} from '../core/pairing.js'
import { connect, disconnect } from '../core/client.js'
import { resetSession } from '../core/auth.js'
import { isValidPhone, sanitizePhone } from '../lib/jid.js'
import { panelAuth, requireToken } from './middleware/auth.js'

const logger = log('web')

export function createServer() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '256kb' }))

  // ── CORS: the hosted landing page (Vercel) calls this API (Render) ──
  app.use((req, res, next) => {
    const origin = req.get('origin') ?? ''
    const allowed = config.corsOrigins
    const permit = allowed.includes('*') || allowed.some((o) => o && origin.startsWith(o))

    if (permit && origin) {
      res.set('access-control-allow-origin', allowed.includes('*') ? '*' : origin)
      res.set('vary', 'origin')
      res.set('access-control-allow-methods', 'GET,POST,OPTIONS')
      res.set('access-control-allow-headers', 'content-type,x-panel-token')
      res.set('access-control-max-age', '86400')
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  // The panel is a single page; all API routes are small and JSON-only.
  app.use('/api', panelAuth)

  // ── health (used by docker healthcheck) ────
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, status: state.status, uptimeMs: Date.now() - state.startedAt })
  })

  // ── status snapshot ────────────────────────
  app.get('/api/status', async (req, res) => {
    let sessionMeta = null
    try {
      sessionMeta = await sessionSummary()
    } catch {
      sessionMeta = null
    }
    res.json({
      ...snapshot(),
      stats: safe(() => summary()),
      registry: registryStats(),
      capabilities: { ...capabilities },
      hasSession: state.hasSession ?? null,
      session: sessionMeta
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

  // ── PUBLIC pairing API (used by the Vercel landing page) ──
  // Only issues a pairing code + a Session ID to the caller who started it.
  app.post('/api/public/pair', async (req, res) => {
    if (rateLimited(req.ip ?? 'unknown')) {
      return res.status(429).json({ ok: false, error: 'Too many pairing attempts from this address. Try again later.' })
    }

    const phone = sanitizePhone(req.body?.phone ?? '')
    if (!isValidPhone(phone)) {
      return res.status(400).json({ ok: false, error: 'Enter your number with the country code, digits only (e.g. 2348012345678).' })
    }

    try {
      const record = await startPublicPairing(phone)
      res.json({
        ok: true,
        phone,
        code: record.code,
        pairToken: record.pairToken,
        expiresAt: record.expiresAt,
        secondsLeft: Math.max(0, Math.ceil((record.expiresAt - Date.now()) / 1000)),
        // The code itself dies after ~60s, even though the pairing record lasts longer.
        codeSecondsLeft: 60,
        instructions:
          'WhatsApp → Linked devices → Link with phone number → enter the code. Act fast: the code expires in about a minute.'
      })
    } catch (error) {
      res.status(error.status ?? 500).json({ ok: false, error: error.message })
    }
  })

  app.get('/api/public/pair/:phone', (req, res) => {
    const record = getPublicPairing(sanitizePhone(req.params.phone))
    if (!record) return res.status(404).json({ ok: false, error: 'No active pairing for that number.' })
    res.json({ ok: true, ...record })
  })

  // ── PUBLIC QR pairing (the "scan instead" tab on the landing page) ──
  app.post('/api/public/qr', async (req, res) => {
    if (rateLimited(req.ip ?? 'unknown')) {
      return res.status(429).json({ ok: false, error: 'Too many pairing attempts from this address. Try again later.' })
    }

    try {
      const record = await startPublicQrPairing()
      res.json({
        ok: true,
        pairingId: record.pairingId,
        qrToken: record.qrToken,
        dataUrl: record.dataUrl,
        expiresAt: record.expiresAt,
        secondsLeft: Math.max(0, Math.ceil((record.expiresAt - Date.now()) / 1000)),
        instructions: 'WhatsApp → Linked devices → Link a device → scan this code.'
      })
    } catch (error) {
      res.status(error.status ?? 500).json({ ok: false, error: error.message })
    }
  })

  app.get('/api/public/qr/:pairingId', (req, res) => {
    const record = readQrPairing(String(req.params.pairingId))
    if (!record) return res.status(404).json({ ok: false, error: 'This QR pairing expired. Start a new one.' })
    res.json({ ok: true, ...record })
  })

  app.post('/api/public/session/qr', async (req, res) => {
    const pairingId = String(req.body?.pairingId ?? '')
    const qrToken = String(req.body?.qrToken ?? '')
    try {
      const sessionId = await claimQrSession(pairingId, qrToken)
      res.json({ ok: true, sessionId })
    } catch (error) {
      res.status(error.status ?? 500).json({ ok: false, error: error.message })
    }
  })

  app.post('/api/public/session', async (req, res) => {
    const phone = sanitizePhone(req.body?.phone ?? '')
    const pairToken = String(req.body?.pairToken ?? '')
    try {
      const sessionId = await claimSession(phone, pairToken)
      res.json({ ok: true, sessionId })
    } catch (error) {
      res.status(error.status ?? 500).json({ ok: false, error: error.message })
    }
  })

  // ── session: read the exportable Session ID ─
  app.get('/api/session', requireToken, async (req, res) => {
    try {
      const summary = await sessionSummary()
      if (!summary.paired) {
        return res.status(409).json({ ok: false, error: 'Not paired yet — pair a number first.' })
      }
      const sessionId = await exportSession()
      res.json({ ok: true, sessionId, ...summary })
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message })
    }
  })

  // ── session: import an ID (restore on a fresh host) ──
  app.post('/api/session', requireToken, async (req, res) => {
    const raw = req.body?.sessionId
    if (!raw) return res.status(400).json({ ok: false, error: 'Paste a session ID first.' })
    try {
      const result = await importSession(raw)
      await disconnect()
      await connect({ fresh: true })
      res.json({ ok: true, ...result, message: 'Session loaded — connecting now.' })
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message })
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
