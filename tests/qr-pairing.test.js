/**
 * QR pairing lifecycle. These never touch the network: the socket-dependent
 * entrypoint (startPublicQrPairing) is a thin wrapper, and everything that
 * decides who gets a Session ID is tested here with injected state.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { closeDb } from './harness.js'

process.env.DB_PATH ||= '/tmp/darkeyes-qr-test.db'

const {
  registerQrPairing,
  readQrPairing,
  claimQrSession,
  pairingBusy,
  cleanupPairings,
  pairingConfig
} = await import('../src/core/pairing.js')

test.after(() => closeDb())

const waiting = { status: 'connecting', qrDataUrl: 'data:image/png;base64,AAAA' }
const scanned = { status: 'connected', qrDataUrl: 'data:image/png;base64,AAAA' }

test('registerQrPairing issues an opaque id, a single-use token and a TTL', () => {
  const record = registerQrPairing('data:image/png;base64,AAAA')
  assert.ok(record.pairingId.length >= 20, 'pairingId should be random, not guessable')
  assert.ok(record.qrToken.length >= 20, 'token should be random')
  assert.equal(record.dataUrl, 'data:image/png;base64,AAAA')
  assert.ok(record.expiresAt > Date.now(), 'must expire in the future')
  assert.ok(record.expiresAt - Date.now() <= pairingConfig.PAIR_TTL_MS)
})

test('readQrPairing returns null for an unknown pairing', () => {
  assert.equal(readQrPairing('does-not-exist', waiting), null)
})

test('readQrPairing reports the waiting state without leaking the token', () => {
  const { pairingId } = registerQrPairing('data:image/png;base64,AAAA')
  const view = readQrPairing(pairingId, waiting)

  assert.equal(view.status, 'connecting')
  assert.equal(view.connected, false)
  assert.equal(view.dataUrl, 'data:image/png;base64,AAAA')
  assert.equal(view.qrToken, undefined, 'the token must never appear in a GET response')
  assert.ok(view.secondsLeft > 0)
})

test('readQrPairing stops serving the QR once the phone is linked', () => {
  const { pairingId } = registerQrPairing('data:image/png;base64,AAAA')
  const view = readQrPairing(pairingId, scanned)

  assert.equal(view.connected, true)
  assert.equal(view.status, 'connected')
  assert.equal(view.dataUrl, null, 'a used QR is worthless — stop handing it out')
})

test('claimQrSession rejects a wrong token', async () => {
  const { pairingId } = registerQrPairing('data:image/png;base64,AAAA')
  await assert.rejects(
    () => claimQrSession(pairingId, 'wrong-token', { snapshot: scanned, exporter: async () => 'DarkEyes~x' }),
    (err) => err.status === 403
  )
})

test('claimQrSession refuses while the QR has not been scanned', async () => {
  const { pairingId, qrToken } = registerQrPairing('data:image/png;base64,AAAA')
  await assert.rejects(
    () => claimQrSession(pairingId, qrToken, { snapshot: waiting, exporter: async () => 'DarkEyes~x' }),
    (err) => err.status === 409
  )
})

test('claimQrSession hands over the Session ID exactly once', async () => {
  const { pairingId, qrToken } = registerQrPairing('data:image/png;base64,AAAA')
  let exports = 0
  const exporter = async () => {
    exports += 1
    return 'DarkEyes~pretend-session'
  }

  const sessionId = await claimQrSession(pairingId, qrToken, { snapshot: scanned, exporter })
  assert.equal(sessionId, 'DarkEyes~pretend-session')
  assert.equal(exports, 1)

  await assert.rejects(
    () => claimQrSession(pairingId, qrToken, { snapshot: scanned, exporter }),
    (err) => err.status === 404 || err.status === 410
  )
  assert.equal(exports, 1, 'a claimed pairing must not produce a second session')
})

test('an active QR pairing makes the next request wait instead of fighting for the socket', () => {
  registerQrPairing('data:image/png;base64,AAAA')
  const busy = pairingBusy()
  assert.ok(busy, 'a live QR pairing must block a second one')
  assert.match(busy, /Another pairing is in progress/i)
})

test('cleanupPairings leaves fresh pairings alone', () => {
  const { pairingId } = registerQrPairing('data:image/png;base64,AAAA')
  cleanupPairings()
  const view = readQrPairing(pairingId, waiting)
  assert.ok(view, 'a pairing created seconds ago must survive the sweeper')
  assert.ok(view.secondsLeft > 0)
})

test('CODE_TTL_MS exposes the real WhatsApp code lifetime (~60s)', () => {
  assert.equal(pairingConfig.CODE_TTL_MS, 60_000)
  assert.ok(pairingConfig.PAIR_TTL_MS > pairingConfig.CODE_TTL_MS, 'the record may outlive the code')
})
