/**
 * Dark Eyes — pairing panel client.
 * Talks only to same-origin /api routes; live updates over SSE.
 */

const $ = (sel) => document.querySelector(sel)
const state = { connected: false, countdownTimer: null, codeDeadline: null }

// ── helpers ─────────────────────────────────
const fmtDuration = (ms = 0) => {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d) return `${d}d ${h}h`
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${s % 60}s`
  return `${s}s`
}

function setPill(status) {
  const pill = $('#pill')
  pill.className = `pill pill--${status}`
  $('#pill-text').textContent =
    ({ connected: 'connected', pairing: 'pairing', connecting: 'connecting', disconnected: 'offline' }[status] ?? status)
}

function showError(message) {
  const box = $('#error')
  if (!message) {
    box.hidden = true
    return
  }
  box.textContent = message
  box.hidden = false
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    ...options
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data
}

// ── rendering ───────────────────────────────
function renderStatus(data) {
  setPill(data.status)
  state.connected = data.status === 'connected'

  $('#pair-card').hidden = state.connected
  $('#live-card').hidden = !state.connected

  if (state.connected) {
    $('#s-number').textContent = data.me?.number ? `+${data.me.number}` : '—'
    $('#s-uptime').textContent = fmtDuration(data.sessionUptimeMs || data.uptimeMs)
    $('#s-messages').textContent = (data.messagesHandled ?? 0).toLocaleString()
    $('#s-commands').textContent = (data.commandsHandled ?? 0).toLocaleString()
    $('#s-groups').textContent = data.stats?.groups ?? 0
    $('#s-users').textContent = data.stats?.users ?? 0
    const r = data.registry
    if (r) {
      $('#s-registry').textContent =
        `${r.commands} commands · ${r.aliases} aliases · ${r.categories} categories` +
        (r.failed ? ` · ${r.failed} failed to load` : '')
    }
  }

  if (data.pairingCode && data.status !== 'connected') {
    showCode(data.pairingCode, data.pairingRequestedAt)
  }

  if (data.capabilities) {
    const list = $('#caps')
    const items = [
      ['ffmpeg', data.capabilities.ffmpeg, 'ffmpeg — audio effects & video stickers'],
      ['ai', data.capabilities.ai, 'AI — chat, vision, generation'],
      ['downloader', data.capabilities.downloader, 'Downloads — YouTube, TikTok, IG…']
    ]
    list.innerHTML = ''
    for (const [, on, label] of items) {
      const li = document.createElement('li')
      li.innerHTML = `<i class="dot ${on ? 'on' : ''}"></i><span>${label}${on ? '' : ' (not configured)'}</span>`
      list.appendChild(li)
    }
  }
}

function showCode(code, requestedAt) {
  $('#code-box').hidden = false
  $('#code').textContent = String(code).match(/.{1,4}/g)?.join('  ') ?? code
  state.codeDeadline = (requestedAt ?? Date.now()) + 60_000
  clearInterval(state.countdownTimer)
  state.countdownTimer = setInterval(() => {
    const left = Math.max(0, state.codeDeadline - Date.now())
    $('#code-countdown').textContent = left > 0 ? `expires in ${Math.ceil(left / 1000)}s` : 'code expired — request a new one'
    if (left <= 0) clearInterval(state.countdownTimer)
  }, 1000)
}

function showQr(dataUrl) {
  const img = $('#qr-img')
  const empty = $('#qr-empty')
  if (!dataUrl) {
    img.hidden = true
    empty.hidden = false
    return
  }
  img.src = dataUrl
  img.hidden = false
  empty.hidden = true
}

// ── actions ─────────────────────────────────
async function requestPairCode() {
  const phone = $('#phone').value.trim()
  showError('')
  if (!/^\d{8,15}$/.test(phone)) {
    showError('Enter your number with the country code, digits only — for example 2348012345678.')
    return
  }

  const btn = $('#btn-pair')
  btn.disabled = true
  btn.textContent = 'Requesting…'
  try {
    await api('/api/pair', { method: 'POST', body: JSON.stringify({ phone }) })
    $('#code-box').hidden = false
    $('#code').textContent = '········'
    $('#code-countdown').textContent = 'waiting for WhatsApp…'
  } catch (error) {
    showError(error.message)
  } finally {
    btn.disabled = false
    btn.textContent = 'Get code'
  }
}

async function requestQr() {
  showError('')
  const btn = $('#btn-qr')
  btn.disabled = true
  btn.textContent = 'Generating…'
  try {
    await api('/api/qr', { method: 'POST' })
  } catch (error) {
    showError(error.message)
  } finally {
    btn.disabled = false
    btn.textContent = 'Generate QR'
  }
}

async function logout() {
  if (!confirm('Log out and delete the saved session? You will need to pair again.')) return
  try {
    await api('/api/logout', { method: 'POST' })
    showQr(null)
    $('#code-box').hidden = true
  } catch (error) {
    showError(error.message)
  }
}

// ── live events ─────────────────────────────
function connectEvents() {
  const source = new EventSource('/api/events')

  source.addEventListener('status', (event) => {
    try {
      renderStatus(JSON.parse(event.data))
    } catch {}
  })

  source.addEventListener('qr', (event) => {
    const data = JSON.parse(event.data)
    showQr(data.dataUrl)
    // switch to the QR tab automatically when a QR arrives
    document.querySelector('[data-tab="qr"]')?.click()
  })

  source.addEventListener('pairing-code', (event) => {
    const data = JSON.parse(event.data)
    showCode(data.code, Date.now())
  })

  // NOTE: never use a named SSE event called "error" — EventSource reserves it
  // for transport failures, so a data event with that name looks like a dropout.
  source.addEventListener('pairing-error', (event) => {
    try {
      const data = JSON.parse(event.data)
      if (data.message) showError(data.message)
    } catch {}
  })

  source.addEventListener('session-dead', () => {
    showError('WhatsApp rejected this session. Pair again with a fresh code or QR.')
    showQr(null)
  })

  source.onerror = () => {
    setPill('disconnected')
    $('#pill-text').textContent = 'panel disconnected — retrying'
  }
}

// ── boot ────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === tab))
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.classList.toggle('is-active', panel.dataset.panel === tab.dataset.tab)
      })
    })
  })
}

async function boot() {
  initTabs()
  $('#btn-pair').addEventListener('click', requestPairCode)
  $('#phone').addEventListener('keydown', (e) => e.key === 'Enter' && requestPairCode())
  $('#btn-qr').addEventListener('click', requestQr)
  $('#btn-logout').addEventListener('click', logout)

  try {
    renderStatus(await api('/api/status'))
  } catch (error) {
    showError('Could not reach the bot server. Is it running?')
  }

  connectEvents()

  // refresh the stat cards every 10s while connected
  setInterval(async () => {
    if (!state.connected) return
    try {
      renderStatus(await api('/api/status'))
    } catch {}
  }, 10_000)
}

boot()
