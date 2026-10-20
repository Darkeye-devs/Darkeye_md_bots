# Running the pairing backend without a card

Render sometimes asks for a card — either because a blueprint requested a paid
instance, or as one-off account verification (a **$1 authorisation that is
reversed**, not a charge). If you cannot or will not add a card, here are the
routes that work today, in order of how much I recommend them.

The pairing backend is a plain Node web service. Anything that runs
`node src/index.js` with a public HTTPS URL will do.

---

## Option A — Zeabur (free, no card, works today)

Zeabur's **Free Plan is $0 and needs no credit card**. The trial plan also
carries a **$5/month usage credit**, which is far more than a small pairing
service burns. Services auto-sleep when idle and wake on the next request.

Recommended route when a card is not available.

### Steps

1. <https://zeabur.com> — sign up with GitHub (no card, no phone).
2. **Create Project**, pick a free region.
3. **Add Service -> GitHub -> `Darkeye-devs/Darkeye_md_bots`**. Zeabur finds the
   `Dockerfile` in the repo root and builds it. That file already installs
   ffmpeg plus the native build tools `better-sqlite3` needs, exposes port 3000,
   and runs `node src/index.js` (which respects `$PORT`).
4. **Networking -> Generate Domain** -> `https://<name>.zeabur.app`.
5. **Variables**:
   ```
   CORS_ORIGINS = https://dark-eyes-multiple08021016309-3260.vercel.app
   NODE_ENV     = production
   ```
   Do NOT set `SESSION_ID` or `OWNER_NUMBER`. A pairing server must stay
   unlinked, otherwise it answers `409 This bot is already linked`.
6. From the repo root:

   ```bash
   npm run point:site https://<name>.zeabur.app
   ```

### Caveats

- Free plan has no SLA and auto-sleeps; the first request after idle is slower.
  Fine for pairing.
- The monthly credit is a ceiling: a very busy service may eventually need the
  $5/month Dev plan.

---

## Option A2 — Back4App Containers (free, no card, short-lived)

One free container: 0.25 CPU, 256 MB RAM, 100 GB transfer, custom Dockerfile
from GitHub, free `*.back4app.app` subdomain. But Back4App's own template notes
say a free container runs about **60 minutes per deploy**, so treat it as a demo
host, not a permanent pairing backend. 256 MB is also tight once ffmpeg and
`better-sqlite3` are in the image.

---

## Option A3 — Render Free (only if a card is possible)

- Create a **Web Service** (not a background worker, not a cron job).
- Instance type: **Free**. If the blueprint is used, `render-pairing.yaml`
  already says `plan: free`.
- The $1 card check, when it appears, is anti-fraud verification; it is
  reversed and free services stay free.

Cheapest correct path, and the one the docs assume.

---

## Option B — Railway (no card; check their status page first)

> **20 Oct 2026:** Railway had a major incident and paused new builds for
> non-Pro workspaces. Check <https://status.railway.com> before starting.

Railway's free plan gives **$5 of trial credit for the first 30 days**, then $1
of credit per month. Fine for launching now; for a permanently-on public
service you will eventually want the $5/month Hobby plan, or Render.

### Steps

1. <https://railway.com> → sign in with GitHub (no card, no verification).
2. **New Project → Deploy from GitHub repo → `Darkeye-devs/Darkeye_md_bots`**.
3. Open the service → **Settings**:
   - **Railway Config File**: `railway-pairing.json`
     (this sets start command + health check; without it Railway guesses)
   - **Networking → Generate Domain** so you get a public URL.
4. **Variables**:
   ```
   CORS_ORIGINS = https://dark-eyes-multiple08021016309-3260.vercel.app
   NODE_ENV     = production
   ```
   Do **not** set `SESSION_ID` or `OWNER_NUMBER` — a pairing server must stay
   unlinked, otherwise it answers `409 This bot is already linked`.
5. Wait for the deploy to go green, copy the domain
   (`https://xxxx.up.railway.app`).
6. From the repo root:

   ```bash
   npm run point:site https://xxxx.up.railway.app
   ```

   The first request after idling takes 20–60s while the container starts.

---

## Option C — your own machine (free forever, but not a public service)

Only sensible for the **bot**, not the public pairing site: a laptop, a spare
Android phone with Termux, or a Raspberry Pi.

```bash
git clone https://github.com/Darkeye-devs/Darkeye_md_bots
cd Darkeye_md_bots
npm install
SESSION_ID='DarkEyes~…' OWNER_NUMBER='2348…' TZ=Africa/Lagos node src/index.js
```

The bot then works on WhatsApp as long as that machine is on and online. The
public Vercel pairing page cannot reach it unless you expose it with a tunnel
(`cloudflared tunnel --url http://localhost:3000`).

---

## Option D — old Render account

If you already have a Render account that has run free services before, it is
usually already verified. Log in with that account instead of making a new one —
blueprints, env vars and the free plan all behave the same.

---

## What is genuinely not free in 2026

| Host | Status |
| --- | --- |
| Koyeb | card-free plan removed Feb 2026; new accounts need Pro ($29/mo) |
| Hugging Face Spaces | Docker/Gradio Spaces need PRO ($9/mo); static Spaces only |
| Fly.io, Google Cloud Run, Oracle VM | free allowance exists, but all require a card |
| Render **Static Sites** | free, no card — but cannot run Node or hold a WhatsApp socket |

So: **no card + always-on Node server** is effectively Render-with-a-$1-hold,
Railway's trial, or your own device. There is no fourth option that is both free
and permanent.

---

## Option E — Cloudflare quick tunnel (no account, works in two minutes)

To prove the whole flow end to end tonight, run the backend on your own machine
and expose it with a throwaway public URL. No account, no card, no signup:

```bash
# terminal 1 — the pairing backend
PORT=3000 node src/index.js

# terminal 2 — public https URL, no login needed
cloudflared tunnel --url http://localhost:3000
```

Then open the site pointed at that URL for this session:

```
https://dark-eyes-multiple08021016309-3260.vercel.app/?api=https://<random>.trycloudflare.com
```

Not a permanent host: the URL changes on every restart and dies when the machine
sleeps. Install cloudflared from
<https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/>.
