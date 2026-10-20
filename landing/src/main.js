import './style.css'

/**
 * Dark Eyes — public landing + pairing page.
 * Frontend: Vercel (static). Backend: Render (`VITE_API_BASE_URL`).
 */

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')

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
      <span class="chip"><b>60</b> tests passing</span>
      <span class="chip"><b>0</b> fake features</span>
      <span class="chip"><b>2</b> values to deploy</span>
    </div>

    <div class="card" id="pair">
      <h2>Link your WhatsApp</h2>
      <p class="lede">Enter your number, then type the code into WhatsApp. Nothing is stored on this page.</p>

      <label for="phone">WhatsApp number</label>
      <div class="field">
        <input id="phone" type="tel" inputmode="numeric" placeholder="2348012345678" autocomplete="off" />
        <button id="go" class="primary">Get pairing code</button>
      </div>
      <p class="hint">Country code first, digits only. No <code>+</code>, no spaces.</p>

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
    headers: { 'content-type': 'application/json' },
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

$('#go').addEventListener('click', requestCode)
$('#phone').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') requestCode()
})

// Wake the backend early — free hosts cold-start slowly.
fetch(`${API}/api/health`).catch(() => {})
