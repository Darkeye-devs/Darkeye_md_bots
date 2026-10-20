# Running the pairing backend without a card

Render sometimes asks for a card — either because a blueprint requested a paid
instance, or as one-off account verification (a **$1 authorisation that is
reversed**, not a charge). If you cannot or will not add a card, here are the
routes that work today, in order of how much I recommend them.

The pairing backend is a plain Node web service. Anything that runs
`node src/index.js` with a public HTTPS URL will do.

---

## Option A — Render Free (recommended if a card is possible)

- Create a **Web Service** (not a background worker, not a cron job).
- Instance type: **Free**. If the blueprint is used, `render-pairing.yaml`
  already says `plan: free`.
- The $1 card check, when it appears, is anti-fraud verification; it is
  reversed and free services stay free.

Cheapest correct path, and the one the docs assume.

---

## Option B — Railway (no card, best option that needs nothing from you)

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
