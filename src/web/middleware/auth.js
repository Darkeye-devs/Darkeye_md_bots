import { config } from '../../config/index.js'

/**
 * Optional token gate for the panel.
 * If PANEL_TOKEN is set, mutating routes require it via
 *   - header  x-panel-token: <token>
 *   - or ?token=<token>
 * Read-only status/events stay open so the page can render.
 */
export function panelAuth(req, res, next) {
  res.set('cache-control', 'no-store')
  next()
}

export function requireToken(req, res, next) {
  if (!config.panelToken) return next()

  const provided = req.get('x-panel-token') || req.query.token || ''
  if (provided && provided === config.panelToken) return next()

  return res.status(401).json({ ok: false, error: 'Invalid or missing panel token.', tokenRequired: true })
}
