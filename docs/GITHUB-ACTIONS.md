# Running Dark Eyes on GitHub Actions

GitHub Actions is the only option that costs nothing, needs no card, and needs no
signup beyond the GitHub account you already have. It is also the **least**
reliable place to run a WhatsApp bot. This page is the honest version of both
statements.

Two workflows ship in `.github/workflows/`:

| Workflow | What it does | Usable? |
| --- | --- | --- |
| `bot.yml` | runs **your** bot (outbound only) | yes, with caveats |
| `pairing.yml` | runs the public pairing backend behind a free ngrok static domain | experimental — demo only |

---

## 1. Your bot (`bot.yml`)

### Setup (one minute)

1. Repo → **Settings → Secrets and variables → Actions → New repository secret**
   - `SESSION_ID` — your `DarkEyes~…` string
   - `OWNER_NUMBER` — e.g. `2348012345678`
   - *optional:* `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` to switch on the AI commands
2. **Actions** tab → **Dark Eyes bot** → **Run workflow**

It starts, connects to WhatsApp, and answers commands. `ffmpeg` is installed in
the job so sticker/video commands work.

### How it stays alive

```
schedule: every 5 hours  +  concurrency: cancel-in-progress  +  timeout 350 min
```

- A GitHub-hosted job is **killed at 6 hours** (documented limit).
- This workflow is scheduled every 5 hours and the new run **cancels the old
  one**, so there is always exactly one bot connected — never two fighting over
  the same WhatsApp session.
- The trade-off: a short gap between the cancel and the new connection. WhatsApp
  needs the socket to re-handshake, so expect a few seconds of downtime, and
  occasionally longer if GitHub's scheduler is late.

### The honest caveats

| Issue | Reality |
| --- | --- |
| Schedule precision | GitHub schedules are **best-effort**. Under load a run can start 5–30 minutes late. |
| 6-hour cap | Hard limit on hosted runners. You cannot raise it. |
| Scheduled workflows get disabled | Public repos: **after 60 days with no repository activity**, GitHub disables the schedule. Push anything now and then (or use `workflow_dispatch`) to keep it alive. |
| No public URL | A runner has no inbound port, so the **web panel and pairing page cannot reach the bot**. Pairing must be done elsewhere (the Vercel site → pairing backend). |
| Terms of service | GitHub's Acceptable Use policy expects Actions to be used for CI/CD, not as free general-purpose hosting. Bots living here are common, but it is a grey area and can be throttled or blocked. |
| Minutes | Public repos are free. Private repos consume your monthly Actions minutes and a 24/7 job will burn them. |

**Verdict:** fine for a personal bot you can tolerate dropping offline now and
then. Not something to promise users.

---

## 2. The pairing backend (`pairing.yml`) — experimental

The Vercel page needs a **public HTTPS backend**. A GitHub runner has no inbound
port, so the backend must be tunnelled out. The workflow uses **ngrok's free
static domain**, which keeps the same URL across restarts so the site can stay
pointed at it permanently.

### Setup

1. Create a free ngrok account (<https://dashboard.ngrok.com/signup>) — no card.
2. Copy the **authtoken** → repo secret `NGROK_AUTHTOKEN`.
3. Claim your free **static domain** (Dashboard → Universal Gateway → Domains),
   e.g. `dark-eyes-pair.ngrok-free.app`.
4. Repo **variable** `NGROK_DOMAIN` = `dark-eyes-pair.ngrok-free.app`
   (no `https://`), and `SITE_ORIGIN` = `https://your-site.vercel.app`.
5. **Actions → Dark Eyes pairing (experimental) → Run workflow**.
6. Point the site at it:
   ```bash
   npm run point:site https://dark-eyes-pair.ngrok-free.app
   ```

The landing page already sends `ngrok-skip-browser-warning: true` on every call,
so the free tunnel returns JSON instead of ngrok's HTML warning page.

### Why this is demo-grade, not production

- The tunnel **drops for a few minutes every ~5 hours** while the job restarts.
  Anyone pairing at that moment sees an error and must retry.
- GitHub may delay the scheduled run by 5–30 minutes, so the gap can be longer.
- ngrok free has bandwidth and connection-rate limits, and shows an interstitial
  page to plain browser visits.
- Same Actions terms-of-service caveat as above.

**Verdict:** perfect for proving the flow end to end and for sharing a link with
a handful of testers tonight. If the site is going public, move the backend to
anything with an always-on process — Render free (needs the one-off $1 card
check), Railway, or a small VPS.

---

## 3. What I would actually do

| Goal | Best free option |
| --- | --- |
| Your own bot, now, no card | `bot.yml` here, **or** run it on your PC/phone — a local process is more reliable than Actions |
| Public pairing link for real users | Render free + the $1 verification, or a $5-ish VPS; Actions/ngrok is a stopgap |
| Testing the flow tonight | `pairing.yml` + ngrok static domain |

A local machine has none of the 6-hour, scheduler, or ToS problems — only the
"must stay powered and online" one. For a bot you use daily, that trade is
usually better than Actions.
