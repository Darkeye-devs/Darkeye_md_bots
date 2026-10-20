<!-- DARK EYES — designed banner + badges. If you fork this, keep the credit line. -->

<div align="center">

<img src="https://raw.githubusercontent.com/Darkeye-devs/Darkeye_md_bots/main/docs/assets/banner.png" width="100%" alt="Dark Eyes — the eye that sees" />

<br/>
<br/>

<a href="https://github.com/Darkeye-devs/Darkeye_md_bots/fork">
  <img src="https://img.shields.io/badge/FORK%20THIS%20REPO-6D28D9?style=for-the-badge&logo=git&logoColor=white" alt="Fork" />
</a>
<a href="https://render.com/deploy?repo=https://github.com/Darkeye-devs/Darkeye_md_bots">
  <img src="https://img.shields.io/badge/DEPLOY%20TO%20RENDER-0EA5E9?style=for-the-badge&logo=render&logoColor=white" alt="Deploy to Render" />
</a>
<a href="https://github.com/Darkeye-devs/Darkeye_md_bots/stargazers">
  <img src="https://img.shields.io/badge/STAR%20THE%20REPO-F472B6?style=for-the-badge&logo=github&logoColor=white" alt="Star" />
</a>

<br/>
<br/>

<img src="https://readme-typing-svg.demolab.com?font=Orbitron&weight=800&size=20&duration=2600&pause=900&color=22D3EE&center=true&vCenter=true&width=620&lines=249+commands.+Zero+fake+features.;Paste+2+values.+Bot+is+alive.;60+tests.+Every+command+really+runs.;THE+EYE+THAT+SEES" alt="typing" />

<br/>

<img src="https://img.shields.io/badge/COMMANDS-249-22D3EE?style=flat-square&labelColor=0b0f16" />
<img src="https://img.shields.io/badge/ALIASES-211-8B5CF6?style=flat-square&labelColor=0b0f16" />
<img src="https://img.shields.io/badge/TESTS-81%20passing-34D399?style=flat-square&labelColor=0b0f16" />
<img src="https://img.shields.io/badge/LOAD%20FAILURES-0-F472B6?style=flat-square&labelColor=0b0f16" />
<img src="https://img.shields.io/badge/NODE-20%2B-339933?style=flat-square&logo=node.js&logoColor=white&labelColor=0b0f16" />
<img src="https://img.shields.io/badge/LICENSE-MIT-22D3EE?style=flat-square&labelColor=0b0f16" />

</div>

<br/>

<img src="https://raw.githubusercontent.com/Darkeye-devs/Darkeye_md_bots/main/docs/assets/rule.png" width="100%" />

## 👁️ What is Dark Eyes?

A **WhatsApp MD bot** you can actually finish setting up. Fork it, paste a **Session ID** and your **owner number**, deploy — and it is online.

Most bot repos advertise *"1000+ commands"* and quietly ship a few hundred aliases and a pile of buttons that answer *"coming soon"*. Dark Eyes is built around the opposite rule:

> **A command only exists if it has working code behind it.**

That rule is not a slogan — it is enforced by the loader, measured by an audit script, and proven by 81 tests that execute the real command functions.

<br/>

## ⚡ Deploy in 2 minutes

| Step | What you do | Where |
| :--: | --- | --- |
| **1** | Pair your number, then hit **Copy Session ID** | your panel (`/`) |
| **2** | Paste `SESSION_ID` + `OWNER_NUMBER` | Render |
| **3** | Send `.menu` from your own WhatsApp | anywhere |

No terminal. No permanent disk. No QR stuck on a server log.

<details>
<summary><b>Where do I get a Session ID?</b></summary>

<br/>

**If you deployed with the UI:** open your app URL → pair with the QR or the 8-digit pairing code → scroll to **Session ID for hosting** → copy it. Paste it into `SESSION_ID` and redeploy.

**If you are running locally:** `npm install && npm start` → open `http://localhost:3000` → pair → copy the Session ID. You can delete the local copy afterwards.

> The Session ID packs your whole Baileys auth folder into one base64 string. It rebuilds the login on every boot, which is exactly why free hosts that wipe the disk still work.

</details>

<br/>

## 🚀 One-click deploys

<div align="center">

| Host | Button | Notes |
| --- | --- | --- |
| **Render** | [![Render](https://img.shields.io/badge/Render-0EA5E9?style=for-the-badge&logo=render&logoColor=white)](https://render.com/deploy?repo=https://github.com/Darkeye-devs/Darkeye_md_bots) | runs the bot (`render.yaml` asks for the 2 secrets) |
| **Vercel** | [![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/new/clone?repository-url=https://github.com/Darkeye-devs/Darkeye_md_bots&root-directory=landing&env=VITE_API_BASE_URL) | runs the public landing page in `landing/` |
| **Koyeb** | [![Koyeb](https://img.shields.io/badge/Koyeb-FF009D?style=for-the-badge&logo=koyeb&logoColor=white)](https://app.koyeb.com/services/deploy?type=git&repository=github.com/Darkeye-devs/Darkeye_md_bots&branch=main) | set `PORT=8000` |
| **Railway** | [![Railway](https://img.shields.io/badge/Railway-FF8700?style=for-the-badge&logo=railway&logoColor=white)](https://railway.app/new/template?template=https://github.com/Darkeye-devs/Darkeye_md_bots) | variables tab |
| **Heroku** | [![Heroku](https://img.shields.io/badge/Heroku-430098?style=for-the-badge&logo=heroku&logoColor=white)](https://dashboard.heroku.com/new?template=https://github.com/Darkeye-devs/Darkeye_md_bots) | `app.json` + `Procfile` |
| **Docker** | [![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://github.com/Darkeye-devs/Darkeye_md_bots/blob/main/Dockerfile) | ffmpeg included |
| **ZIP** | [![Download](https://img.shields.io/badge/DOWNLOAD%20.ZIP-8B5CF6?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Darkeye-devs/Darkeye_md_bots/archive/refs/heads/main.zip) | for panels |

</div>

### 🌐 Want a public site? Split it: frontend on Vercel, bot on Render

The repo is built for it. `landing/` is a standalone Vite site that talks to the
bot's API over HTTPS, so you can give users a page instead of a raw panel.
Users pair with **either an 8-digit code or a QR scan** — their choice — and both
paths end in the same Session ID.

A live instance of exactly this setup: **https://dark-eyes-multiple08021016309-3260.vercel.app**

| Half | Host | Why |
| --- | --- | --- |
| `landing/` (static) | **Vercel** | free CDN, instant deploys, custom domain |
| `src/` (Baileys socket + SQLite) | **Render / Koyeb / Railway** | needs a long-lived process, which serverless cannot provide |

```
user → dark-eyes.vercel.app → (CORS) → dark-eyes-bot.onrender.com → WhatsApp
```

Pairing on the public site is guarded: **6 requests per IP per hour**, one pairing
at a time, a single-use `pairToken` before the Session ID is handed over, and
abandoned pairings expire in 15 minutes.

No card available? Use **Zeabur** — free plan, no card, deploys this repo's
Dockerfile as-is. Railway, Back4App and a zero-signup Cloudflare tunnel are also
covered in **[docs/PAIRING-WITHOUT-CARD.md](docs/PAIRING-WITHOUT-CARD.md)**.

Connect the site to a pairing backend in one command:

```bash
npm run point:site https://your-pairing-service.onrender.com
```

Then set `CORS_ORIGINS` on that service to your site's origin. Full walkthrough
with the two service blueprints: **[docs/VERCEL-SPLIT.md](docs/VERCEL-SPLIT.md)**.

Point the page at your own bot with one visit — no rebuild:

```
https://your-site.vercel.app/?api=https://your-bot.onrender.com
```

Or set `apiBaseUrl` in `landing/public/config.json`. Redeploy the static site
from the command line with `npm run deploy:vercel` (needs `VERCEL_TOKEN`).

Full walkthrough — env vars, CLI commands, CORS gotchas, troubleshooting:
**[docs/VERCEL-SPLIT.md](docs/VERCEL-SPLIT.md)**

Every data command calls a real API — the full list, with which ones need a
key and which are free: **[docs/APIS.md](docs/APIS.md)**

> [!WARNING]
> **Free tiers sleep.** Render's free web service idles out after ~15 minutes, and a sleeping bot cannot answer WhatsApp messages. Ping `/api/health` every 5 minutes with a free uptime monitor, or take the Starter plan (~$7/month) for 24/7.
>
> **Service type vs instance type.** You always create a *Web Service* — "instance" is just the size/plan you pick inside it. The blueprint ships with `plan: free`; choose **Free** in the dashboard if it asks. Render may also ask new accounts to verify a card with a **$1 authorisation that is reversed** — that is fraud prevention, not a subscription, and free services stay free.

<br/>

## 🧠 Why this one is different

<table>
<tr><th align="left">Claim</th><th align="left">How it is enforced</th></tr>
<tr>
<td><b>Every command works</b></td>
<td>Each plugin has a real <code>execute()</code>. <code>npm test</code> runs 60 behavioural tests against those functions with a fake socket and a real database.</td>
</tr>
<tr>
<td><b>No padded counts</b></td>
<td>The registry refuses duplicate names <i>and</i> aliases that shadow commands. It caught <b>5 real collisions</b> while this repo was being built.</td>
</tr>
<tr>
<td><b>Honest numbers</b></td>
<td><code>npm run audit</code> grades any target list against the live registry and writes <code>docs/AUDIT.md</code>.</td>
</tr>
<tr>
<td><b>No dead buttons</b></td>
<td>A command needing a key or a binary says exactly what is missing instead of silently failing.</td>
</tr>
<tr>
<td><b>No reconnect storms</b></td>
<td>Reconnects are single-flight with 2s → 4s → 8s → 16s → 30s backoff, capped at 12 attempts. (An earlier build opened 58 sockets in 13s — that bug is now a regression test.)</td>
</tr>
</table>

<br/>

## 📊 The honest scoreboard

Audited against the popular 1,000-command list:

| Measure | Count |
| --- | ---: |
| Names on that list | 1000 |
| **Implemented with real code** | **213** |
| Reachable through an alias | 116 |
| Covered by an equivalent command | 73 |
| Not built — each with a written reason | 598 |
| **Live commands we ship** | **249** (+211 aliases) |
| **Commands we built that are not on that list** | **36** |

The 598 gaps are documented, not hidden: DRM-protected music downloads, paid image APIs, social "stalk" endpoints, and game engines that were not built yet. → [`docs/AUDIT.md`](docs/AUDIT.md)

<br/>

## 🧩 Command categories

<div align="center">

| Category | Count | Highlights |
| :--- | ---: | :--- |
| 🎲 **Fun** | 54 | 8ball · dice · rps · trivia · guess-the-number · unbeatable tic-tac-toe · slots · ship · 38 roleplay reactions |
| 🎬 **Media** | 50 | sticker · toimg · tovideo · take · view-once reveal · getpp · 13 image effects · 11 download sites |
| 🧰 **Tools** | 38 | units · currency · crypto · calc · roman · base64/binary/hex · password · QR · weather · DNS · whois · translate · define |
| 🛡️ **Moderation** | 35 | kick · add · promote · mute · tagall · hidetag · warns · antilink · antispam · antibadword · welcome/goodbye |
| 👑 **Owner** | 16 | mode · broadcast · backup · reload · restart · block · join · session · shell · eval |
| 📌 **Misc** | 15 | reminders · notes · to-do · AFK · timer |
| 💰 **Economy** | 13 | daily · work · fish · mine · bank · pay · rob · gamble · shop · inventory · richlist |
| 🌐 **General** | 11 | menu · ping · stats · info · me · rules |
| 🧠 **AI** | 10 | chat with memory · summarize · rewrite · grammar · imagine · describe · forget |

</div>

Full list: [`docs/COMMANDS.md`](docs/COMMANDS.md) — generated from the live registry, never hand-written.

<br/>

## 🔑 Keys & capabilities

The core is **key-free**. This table is the only place anything optional appears:

| Feature | Needs | Free option |
| --- | --- | --- |
| AI chat, vision, image generation | `AI_API_KEY` | ✅ Groq or OpenRouter free tiers |
| Downloads (YouTube, TikTok, IG, X…) | `DOWNLOAD_API_URL` | ✅ self-host `yt-dlp` behind a 20-line resolver |
| Video stickers, audio effects | `ffmpeg` | ✅ preinstalled in the Docker image |

Commands without their key stay **dormant** and tell the user exactly what to add. Nothing pretends.

<br/>

## 📁 Project layout

```
src/
├── core/       engine — client, session, registry, router, middleware, context
├── handlers/   message, group, call, reaction, automod, autoai
├── plugins/    every feature (9 categories)
├── services/   database, ai, sticker, textmaker, downloader, economy, scheduler
├── lib/        pure helpers (jid, text, time, parse, target, errors)
├── db/         schema.sql + migrations
└── web/        pairing panel (express + SSE, dark UI)
```

**[Architecture →](docs/ARCHITECTURE.md)** · **[Plugin guide →](docs/PLUGINS.md)** · **[Hosting →](docs/HOSTING.md)** · **[Deploying →](docs/DEPLOY.md)**

<br/>

## 🛠️ For developers

```bash
git clone https://github.com/Darkeye-devs/Darkeye_md_bots
cd Darkeye_md_bots
npm install
cp .env.example .env      # set OWNER_NUMBER
npm start                 # → http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm start` | bot + panel |
| `npm test` | 60 behavioural tests |
| `npm run audit` | grade a command list → `docs/AUDIT.md` |
| `npm run docs` | regenerate `docs/COMMANDS.md` |
| `npm run check` | parse every source file |
| `npm run verify` | all of the above in one go |
| `npm run assets` | rebuild the banner, logo and social image |

Adding a command is one file drop:

```js
export default {
  name: 'sticker',
  aliases: ['s'],
  category: 'media',
  description: 'Turn an image or video into a WhatsApp sticker',
  cooldown: 4,
  requires: { ffmpeg: true },
  async execute(ctx) {
    const buffer = await ctx.download()
    return ctx.sock.sendMessage(ctx.chat, { sticker: buffer })
  }
}
```

Permissions, cooldowns, capability gating, error handling, menu registration and the help card all come free from the pipeline.

<br/>

## ⚖️ Notice

> Built for **educational use**. This is an **unofficial** WhatsApp client (Baileys) — technically against WhatsApp's Terms of Service, as with every MD bot. Use a number you can afford to lose. No spam tooling is included, on purpose.

## 📜 Credits

| Role | Credit |
| --- | --- |
| 👨‍💻 Developer | **Darkeye Devs** |
| 📦 Core library | [WhiskeySockets / Baileys](https://github.com/WhiskeySockets/Baileys) |
| 🖼️ Engine of images | [sharp](https://sharp.pixelplumbing.com/) + `ffmpeg` |
| 🗄️ Storage | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |

<br/>

<div align="center">

<img src="https://raw.githubusercontent.com/Darkeye-devs/Darkeye_md_bots/main/docs/assets/logo.png" width="96" alt="Dark Eyes" />

**《 DARK EYES — THE EYE THAT SEES 》**

<sub>If this repo helped you, a ⭐ costs nothing and helps a lot.</sub>

</div>
