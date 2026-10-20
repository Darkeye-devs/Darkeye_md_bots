import './style.css'

/**
 * Dark Eyes — public landing + pairing page.
 * Frontend: Vercel (static). Backend: Render (`VITE_API_BASE_URL`).
 */

/**
 * Resolve the backend URL, in priority order:
 *   1. ?api=https://… in the address bar  (saved, so it survives reloads)
 *   2. config.json served next to the site (edit without touching code)
 *   3. VITE_API_BASE_URL from the build environment
 *   4. localhost, for development
 * This is why the site still works when the Render URL is created after deploy.
 */
let API = ''

async function resolveApi() {
  const fromUrl = new URLSearchParams(location.search).get('api')
  if (fromUrl) {
    localStorage.setItem('darkeyes_api', fromUrl)
    history.replaceState({}, '', location.pathname + location.hash)
  }

  const saved = localStorage.getItem('darkeyes_api')
  if (saved) return saved.replace(/\/+$/, '')

  try {
    const res = await fetch('./config.json', { cache: 'no-store' })
    const cfg = await res.json()
    if (cfg?.apiBaseUrl) return String(cfg.apiBaseUrl).replace(/\/+$/, '')
  } catch {
    /* config.json is optional */
  }

  return (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
}

const app = document.getElementById('app')

app.innerHTML = `
<div class="glow"></div>
<div class="wrap">
  <nav>
    <div class="brand">
      <img src="./logo.png" alt="" />
      <span>DARK EYES</span>
    </div>
    <div class="links">
      <a href="#pair">Pair</a>
      <a href="#why">Why</a>
      <a href="https://github.com/Darkeye-devs/Darkeye_md_bots" target="_blank" rel="noopener">GitHub</a>
      <a href="https://github.com/Darkeye-devs/Darkeye_md_bots/blob/main/docs/HOSTING.md" target="_blank" rel="noopener">Hosting</a>
    </div>
  </nav>

  <header>
    <img class="banner" src="./banner.png" alt="Dark Eyes" />
    <h1><span class="grad">PAIR. DEPLOY. DONE.</span></h1>
    <p class="sub">
      A WhatsApp MD bot with 249 commands that actually run. Pair your number here,
      get your Session ID, paste two values into Render — and it is live.
    </p>
    <div class="chips">
      <span class="chip"><b>249</b> commands</span>
      <span class="chip"><b>211</b> aliases</span>
      <span class="chip"><b>81</b> tests passing</span>
      <span class="chip"><b>0</b> fake features</span>
      <span class="chip"><b>2</b> values to deploy</span>
    </div>

    <div class="card" id="pair">
      <h2>Link your WhatsApp</h2>
      <p class="lede">Two ways in — pick whichever your phone gives you. Nothing is stored on this page.</p>

      <div id="notice"></div>

      <div class="tabs" role="tablist">
        <button class="tab active" id="tab-code" role="tab" aria-selected="true">8-digit code</button>
        <button class="tab" id="tab-qr" role="tab" aria-selected="false">QR code</button>
      </div>

      <div id="pane-code">
        <label for="phone">WhatsApp number</label>
        <div class="field">
          <input id="phone" type="tel" inputmode="numeric" placeholder="2348012345678" autocomplete="off" />
          <button id="go" class="primary">Get pairing code</button>
        </div>
        <p class="hint">Country code first, digits only. No <code>+</code>, no spaces.</p>
      </div>

      <div id="pane-qr" hidden>
        <p class="hint" style="margin:0 0 12px">
          No number needed. Open <b>WhatsApp → Linked devices → Link a device</b>, then scan.
        </p>
        <button id="go-qr" class="primary wide">Show QR code</button>
      </div>

      <div id="out"></div>
    </div>
  </header>

  <div class="grid3" id="why">
    <div class="tile">
      <span class="num">249</span>
      <h3>Commands that work</h3>
      <p>Every command has a real implementation and a behavioural test. No placeholders, no "coming soon".</p>
    </div>
    <div class="tile">
      <span class="num">2</span>
      <h3>Values to deploy</h3>
      <p><code>SESSION_ID</code> and <code>OWNER_NUMBER</code>. That is the entire setup on Render, Koyeb or Railway.</p>
    </div>
    <div class="tile">
      <span class="num">0</span>
      <h3>Fake features</h3>
      <p>The loader rejects duplicate commands and shadowed aliases. The audit script publishes the honest numbers.</p>
    </div>
  </div>

  <footer>
    <p>
      <a href="https://github.com/Darkeye-devs/Darkeye_md_bots">GitHub</a> ·
      <a href="https://github.com/Darkeye-devs/Darkeye_md_bots/blob/main/docs/HOSTING.md">Hosting guide</a> ·
      <a href="https://github.com/Darkeye-devs/Darkeye_md_bots/blob/main/docs/COMMANDS.md">All commands</a>
    </p>
    <p>Built on Baileys. Unofficial client — use a number you can afford to lose.</p>
    <p style="opacity:.6">《 DARK EYES — THE EYE THAT SEES 》</p>
  </footer>
</div>
`

const $ = (sel) => document.querySelector(sel)
const out = $('#out')

let poll = null
let countdown = null
let state = { phone: null, pairToken: null, expiresAt: 0 }
let qr = { pairingId: null, qrToken: null }

function clearTimers() {
  clearInterval(poll)
  clearInterval(countdown)
  poll = null
  countdown = null
}

function alertBox(kind, html) {
  const div = document.createElement('div')
  div.className = `alert ${kind}`
  div.innerHTML = html
  return div
}

async function call(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    // ngrok-skip-browser-warning keeps free ngrok tunnels from returning their
    // HTML interstitial instead of JSON. Harmless on Render/Zeabur/any host.
    headers: { 'content-type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    ...options
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

function showCode(code, secondsLeft) {
  out.innerHTML = ''
  const box = document.createElement('div')
  box.className = 'code-box'
  box.innerHTML = `
    <span class="cap">WhatsApp → Linked devices → Link with phone number → enter this</span>
    <div class="code" id="code">${String(code).match(/.{1,4}/g)?.join('  ') ?? code}</div>
    <div class="code-meta" id="meta">expires in ${secondsLeft}s</div>
  `
  out.appendChild(box)
  out.appendChild(
    alertBox('warn', 'This code expires in about a minute. Keep this page open — the Session ID appears here the moment your phone links.')
  )

  state.expiresAt = Date.now() + secondsLeft * 1000
  clearInterval(countdown)
  countdown = setInterval(() => {
    const left = Math.max(0, Math.round((state.expiresAt - Date.now()) / 1000))
    const meta = document.getElementById('meta')
    if (!meta) return
    meta.textContent = left > 0 ? `expires in ${left}s` : 'code expired — request a new one'
    if (left <= 0) clearInterval(countdown)
  }, 1000)
}

function showSession(sessionId) {
  clearTimers()
  out.innerHTML = ''
  out.appendChild(alertBox('ok', '✅ <b>Linked.</b> Here is your Session ID — copy it now, it is shown once.'))

  const wrap = document.createElement('div')
  wrap.className = 'session'
  wrap.innerHTML = `
    <label for="sid">SESSION_ID</label>
    <textarea id="sid" rows="4" readonly spellcheck="false">${sessionId}</textarea>
    <div class="actions">
      <button id="copy" class="primary">Copy Session ID</button>
      <button id="download" class="ghost">Download .env</button>
    </div>
    <ul class="steps">
      <li><b>1</b><span>Fork the repo on GitHub.</span></li>
      <li><b>2</b><span>Deploy to Render with <code>SESSION_ID</code> = the string above and <code>OWNER_NUMBER</code> = your number.</span></li>
      <li><b>3</b><span>Send <code>.menu</code> from your WhatsApp. That is it.</span></li>
    </ul>
    <div class="alert warn" style="margin-top:16px">
      ⚠️ This string is the keys to your WhatsApp account. Never post it, screenshot it, or commit it.
    </div>
    <div class="actions" style="margin-top:14px">
      <a href="https://render.com/deploy?repo=https://github.com/Darkeye-devs/Darkeye_md_bots" target="_blank" rel="noopener">
        <button class="primary">Deploy to Render →</button>
      </a>
    </div>
  `
  out.appendChild(wrap)

  $('#copy').addEventListener('click', async () => {
    const value = $('#sid').value
    try {
      await navigator.clipboard.writeText(value)
      $('#copy').textContent = '✅ Copied'
      setTimeout(() => ($('#copy').textContent = 'Copy Session ID'), 1800)
    } catch {
      $('#sid').select()
    }
  })

  $('#download').addEventListener('click', () => {
    const body = [
      `SESSION_ID=${sessionId}`,
      'OWNER_NUMBER=',
      'BOT_NAME=Dark Eyes',
      'PREFIX=.',
      'BOT_MODE=public',
      'TZ=Africa/Lagos'
    ].join('\n')
    const blob = new Blob([body], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'dark-eyes.env'
    link.click()
    URL.revokeObjectURL(link.href)
  })
}

function showQr(dataUrl, secondsLeft) {
  out.innerHTML = ''
  const box = document.createElement('div')
  box.className = 'qr-box'
  box.innerHTML = `
    <span class="cap">WhatsApp → Linked devices → Link a device → scan this</span>
    <img id="qr-img" alt="WhatsApp pairing QR code" src="${dataUrl}" />
    <div class="code-meta" id="meta">expires in ${secondsLeft}s</div>
  `
  out.appendChild(box)
  out.appendChild(
    alertBox(
      'warn',
      'The QR refreshes itself every few seconds. Keep this page open — your Session ID appears here the moment the scan is accepted.'
    )
  )

  state.expiresAt = Date.now() + secondsLeft * 1000
  clearInterval(countdown)
  countdown = setInterval(() => {
    const left = Math.max(0, Math.round((state.expiresAt - Date.now()) / 1000))
    const meta = document.getElementById('meta')
    if (!meta) return
    meta.textContent = left > 0 ? `expires in ${left}s` : 'QR expired — get a new one'
    if (left <= 0) clearInterval(countdown)
  }, 1000)
}

function startQrPolling() {
  clearInterval(poll)
  poll = setInterval(async () => {
    try {
      const status = await call(`/api/public/qr/${qr.pairingId}`)

      if (status.connected) {
        clearTimers()
        out.innerHTML = ''
        out.appendChild(alertBox('ok', '📱 Device linked. Generating your Session ID…'))

        const { sessionId } = await call('/api/public/session/qr', {
          method: 'POST',
          body: JSON.stringify({ pairingId: qr.pairingId, qrToken: qr.qrToken })
        })

        if (sessionId) showSession(sessionId)
        else out.appendChild(alertBox('warn', 'Linked, but WhatsApp did not hand back a session. Try again.'))
        return
      }

      // WhatsApp rotates the QR every ~20s — swap the image in place.
      if (status.dataUrl) {
        const img = document.getElementById('qr-img')
        if (img && img.src !== status.dataUrl) img.src = status.dataUrl
      }

      if (status.secondsLeft <= 0) {
        clearTimers()
        const meta = document.getElementById('meta')
        if (meta) meta.textContent = 'QR expired — get a new one'
      }
    } catch {
      /* keep polling; the backend may be waking up */
    }
  }, 2500)
}

async function requestQr() {
  const button = $('#go-qr')
  button.disabled = true
  button.textContent = 'Opening…'
  out.innerHTML = ''
  out.appendChild(alertBox('ok', 'Opening a socket and asking WhatsApp for a QR… (a cold free-tier instance can take ~30s)'))

  try {
    const data = await call('/api/public/qr', { method: 'POST' })
    qr = { pairingId: data.pairingId, qrToken: data.qrToken }
    showQr(data.dataUrl, data.secondsLeft)
    startQrPolling()
  } catch (error) {
    out.innerHTML = ''
    out.appendChild(alertBox('error', error.message))
    out.appendChild(alertBox('warn', 'You can switch to the 8-digit code tab instead — it works even when QR does not.'))
  } finally {
    button.disabled = false
    button.textContent = 'Show QR code'
  }
}

function startPolling() {
  clearInterval(poll)
  poll = setInterval(async () => {
    try {
      const status = await call(`/api/public/pair/${state.phone}`)

      if (status.connected) {
        clearTimers()
        out.innerHTML = ''
        out.appendChild(alertBox('ok', '📱 Phone linked. Generating your Session ID…'))

        const { sessionId } = await call('/api/public/session', {
          method: 'POST',
          body: JSON.stringify({ phone: state.phone, pairToken: state.pairToken })
        })

        if (sessionId) {
          showSession(sessionId)
        } else {
          out.appendChild(alertBox('warn', 'Linked, but WhatsApp did not hand back a session. Try again, or pair from the bot panel.'))
        }
        return
      }

      if (status.secondsLeft <= 0 && status.code) {
        clearTimers()
        const meta = document.getElementById('meta')
        if (meta) meta.textContent = 'code expired — request a new one'
      }
    } catch {
      /* keep polling; the backend may be waking up */
    }
  }, 3000)
}

async function requestCode() {
  const phone = $('#phone').value.replace(/[^\d]/g, '')
  if (!/^\d{8,15}$/.test(phone)) {
    out.innerHTML = ''
    out.appendChild(alertBox('error', 'Enter your number with the country code, digits only — for example 2348012345678.'))
    return
  }

  const button = $('#go')
  button.disabled = true
  button.textContent = 'Requesting…'
  out.innerHTML = ''
  out.appendChild(alertBox('ok', 'Opening a socket and asking WhatsApp for a code… (the free tier may need ~30s to wake)'))

  try {
    const data = await call('/api/public/pair', { method: 'POST', body: JSON.stringify({ phone }) })
    state = { phone: data.phone, pairToken: data.pairToken, expiresAt: data.expiresAt }

    if (!data.code) {
      out.innerHTML = ''
      out.appendChild(alertBox('warn', 'WhatsApp did not return a code. Wait a few seconds and try again.'))
      return
    }

    showCode(data.code, data.secondsLeft)
    startPolling()
  } catch (error) {
    out.innerHTML = ''
    out.appendChild(alertBox('error', error.message))
  } finally {
    button.disabled = false
    button.textContent = 'Get pairing code'
  }
}

async function boot() {
  API = await resolveApi()

  // A localhost fallback on a deployed site means nobody configured the backend.
  const looksLocal = API.includes('localhost') || API.includes('127.0.0.1')
  if (looksLocal && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    const notice = $('#notice')
    notice.innerHTML = ''
    notice.appendChild(
      alertBox(
        'warn',
        `Pairing is not switched on yet — no bot backend is linked to this site.
         If you are the operator, open this page once as
         <code>/?api=https://YOUR-BOT.onrender.com</code> or set
         <code>apiBaseUrl</code> in <code>config.json</code>.`
      )
    )
  }

  // Wake the backend early — free hosts cold-start slowly.
  fetch(`${API}/api/health`, { headers: { 'ngrok-skip-browser-warning': 'true' } }).catch(() => {})

  $('#go').addEventListener('click', requestCode)
  $('#phone').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') requestCode()
  })
  $('#go-qr').addEventListener('click', requestQr)

  const selectTab = (which) => {
    const isCode = which === 'code'
    $('#tab-code').classList.toggle('active', isCode)
    $('#tab-qr').classList.toggle('active', !isCode)
    $('#tab-code').setAttribute('aria-selected', String(isCode))
    $('#tab-qr').setAttribute('aria-selected', String(!isCode))
    $('#pane-code').hidden = !isCode
    $('#pane-qr').hidden = isCode
    // Switching modes abandons the previous attempt, so stop its timers.
    clearTimers()
    out.innerHTML = ''
  }

  $('#tab-code').addEventListener('click', () => selectTab('code'))
  $('#tab-qr').addEventListener('click', () => selectTab('qr'))
}

boot()
