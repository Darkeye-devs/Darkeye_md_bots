/**
 * Regression tests for the reconnect storm.
 *
 * A failed connection used to call connect() directly from the close handler,
 * producing 58 sockets in 13 seconds. These tests keep the throttle honest.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

process.env.LOG_LEVEL = 'silent'
process.env.DB_PATH = '/tmp/darkeyes-reconnect-test.db'

const { backoffDelay, scheduleReconnect, cancelReconnect, MAX_RECONNECT_ATTEMPTS } = await import(
  '../src/core/client.js'
)
const { state } = await import('../src/core/state.js')

test('backoff grows exponentially and then caps', () => {
  const delays = [1, 2, 3, 4, 5, 6, 7, 8].map((attempt) => backoffDelay(attempt, 0))
  assert.deepEqual(delays.slice(0, 5), [2000, 4000, 8000, 16000, 30000])
  assert.equal(delays[7], 30000, 'delay must stay capped at 30s')
  for (let i = 1; i < delays.length; i++) {
    assert.ok(delays[i] >= delays[i - 1], 'delay must never shrink')
  }
})

test('jitter keeps the delay inside a sane band', () => {
  assert.equal(backoffDelay(1, 0), 2000)
  assert.equal(backoffDelay(1, 1), 3000)
})

test('scheduleReconnect is single-flight', () => {
  state.reconnectAttempts = 0
  cancelReconnect()

  scheduleReconnect()
  const afterFirst = state.reconnectAttempts
  scheduleReconnect()
  scheduleReconnect()

  assert.equal(afterFirst, 1)
  assert.equal(state.reconnectAttempts, 1, 'repeat calls must not stack timers')

  cancelReconnect()
})

test('reconnect gives up after the attempt cap', () => {
  state.reconnectAttempts = MAX_RECONNECT_ATTEMPTS
  cancelReconnect()

  scheduleReconnect()

  assert.match(state.lastError ?? '', /Gave up after 12 reconnect attempts/)
  assert.equal(state.reconnectAttempts, MAX_RECONNECT_ATTEMPTS, 'must not keep incrementing')

  state.reconnectAttempts = 0
  state.lastError = null
  cancelReconnect()
})

test('cancelReconnect clears the pending timer', () => {
  state.reconnectAttempts = 0
  cancelReconnect()
  scheduleReconnect()
  cancelReconnect()
  // after cancelling, a fresh schedule must be allowed again
  scheduleReconnect()
  assert.equal(state.reconnectAttempts, 2)
  cancelReconnect()
  state.reconnectAttempts = 0
})
