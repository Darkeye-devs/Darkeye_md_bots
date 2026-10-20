# 👁️ Dark Eyes

**the eye that sees**

A WhatsApp bot built the honest way: **248 commands that actually run**, a browser pairing panel (QR *or* 8-digit code), a plugin engine that validates itself, and an audit script that proves the numbers.

No "1,000 commands" list padded with aliases and dead buttons.

```
╭──────────────────────────────╮
│  👁️  DARK EYES               │
│  248 commands · 209 aliases  │
╰──────────────────────────────╯
```

---

## What makes this different

| Claim | How it is enforced |
| --- | --- |
| Every command works | Each plugin has a real `execute()`. `npm test` runs 51 behavioural tests against those functions. |
| No duplicate "features" | The registry refuses duplicate names **and** aliases that shadow commands. It caught 5 real collisions during development. |
| Honest counts | `.menu` renders from the live registry. Aliases are listed beside their command, never as separate features. |
| No fake "coming soon" | A command needing a key (`AI_API_KEY`, `DOWNLOAD_API_URL`) or a binary (`ffmpeg`) says **exactly** what is missing instead of failing silently. |
| Numbers you can verify | `npm run audit` compares any target list against the registry and writes `docs/AUDIT.md`. |

Current audit against the 1,000-command target list: **213 implemented · 116 alias-covered · 73 equivalent · 598 not built (each with a reason)**. See [`docs/AUDIT.md`](docs/AUDIT.md).

---

## Quick start

```bash
git clone <your-repo> dark-eyes-bot
cd dark-eyes-bot
npm install
cp .env.example .env      # then edit OWNER_NUMBER at minimum
npm start
```

Open **http://localhost:3000** and pair:

- **Pairing code** — type your number (country code first, digits only), copy the 8-digit code, then in WhatsApp go to **Linked devices → Link with phone number**.
- **QR code** — click *Generate QR*, then **Linked devices → Link a device**.

The session is saved in `data/auth/`, so restarts do not require re-pairing.

### Requirements

- Node.js **20+**
- `ffmpeg` *(optional)* — video → sticker, audio effects, sticker → video
- No API keys needed for the core 248 commands. AI and downloaders activate when you add keys.

---

## Getting your API keys

Several things work with **no key at all** — currency, crypto, weather, dictionary, DNS, IP lookup, QR codes, text-maker images, images/stickers (via `sharp`), games, economy, reminders, moderation.

These need a key or a binary. Set the variables in `.env`:

| Feature | Variable | Free option? |
| --- | --- | --- |
| AI chat / vision / images | `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | ✅ **Groq** and **OpenRouter** both have free tiers and are OpenAI-compatible — set `AI_BASE_URL=https://api.groq.com/openai/v1` or `https://openrouter.ai/api/v1` |
| Media downloads (YT, TikTok, IG…) | `DOWNLOAD_API_URL` | ✅ Self-host [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) behind a tiny HTTP wrapper (see `docs/DEPLOY.md`). Paid APIs also exist if you prefer. |
| Video stickers, audio effects | *(none — install `ffmpeg`)* | ✅ `apt install ffmpeg` |

> **Heads up on "premium" APIs:** remove.bg (background removal), Spotify/Apple Music/Tidal downloads (DRM), and serious OCR/voice cloning have **no free tier**. I have not registered those commands — the audit lists them as not built with that exact reason, rather than shipping a button that fails.

---

## Architecture

```
src/
├── index.js              boot: config → db → plugins → web panel → socket
├── config/               env parsing + validation (fails fast on bad config)
├── core/                 the engine — no bot features live here
│   ├── client.js         Baileys socket factory, reconnect with backoff
│   ├── connection.js     QR / pairing code / disconnect handling
│   ├── auth.js           session persistence + reset
│   ├── registry.js       loads & validates plugins, resolves aliases
│   ├── router.js         text → command → context → plugin
│   ├── middleware.js     mode → permissions → capabilities → cooldown
│   ├── context.js        the ctx object every plugin receives
│   └── state.js          live runtime state (read by the panel)
├── handlers/             message, group, call, reaction, automod, autoai
├── plugins/              ← all features live here (9 categories)
├── services/             database, ai, sticker, textmaker, downloader, economy, scheduler
├── lib/                  pure helpers: jid, text, time, parse, target, errors
├── db/                   schema.sql + migrations
└── web/                  express panel: SSE status, pairing routes, dark UI
```

Full details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

### The plugin contract

Drop a file in `src/plugins/<category>/`:

```js
export default {
  name: 'sticker',
  aliases: ['s'],
  category: 'media',
  description: 'Turn an image or video into a WhatsApp sticker',
  usage: '.sticker (reply to media)',
  cooldown: 4,
  requires: { ffmpeg: true },
  async execute(ctx) {
    const buffer = await ctx.download()
    return ctx.sock.sendMessage(ctx.chat, { sticker: buffer })
  }
}
```

Shipped plugins get: automatic permission checks, cooldowns, capability gating, error handling, menu registration, help text, and a place in the audit report.

---

## Commands

Run `.menu` in WhatsApp, or read the generated reference: [`docs/COMMANDS.md`](docs/COMMANDS.md).

| Category | Count | Highlights |
| --- | ---: | --- |
| Fun | 54 | 8ball, dice, rps, trivia, guess-the-number, unbeatable tic-tac-toe, slots, ship, 38 roleplay reactions |
| Media | 50 | sticker, toimg, tovideo, take, vv, getpp, 13 image effects, 11 download sites |
| Tools | 38 | units, currency, crypto, calc, roman, base64/binary/hex, password, QR, weather, DNS, whois, translate, define |
| Moderation | 35 | kick/add/promote/demote, mute, tagall, hidetag, warns, antilink, antispam, antibadword, welcome/goodbye |
| Owner | 16 | mode, broadcast, backup, reload, restart, block, join, shell, eval |
| Misc | 15 | reminders, notes, to-do, AFK, timer |
| Economy | 13 | daily, work, fish, mine, bank, pay, rob, gamble, shop, inventory, richlist |
| General | 11 | menu, ping, stats, info, me, rules |
| AI | 10 | ai chat (per-chat memory), summarize, translate, imagine, describe, forget |

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Run the bot + panel |
| `npm run dev` | Same, with watch mode |
| `npm test` | 51 behavioural tests (real plugin execution) |
| `npm run check` | Parse every source file |
| `npm run audit` | Compare a target command list with the live registry → `docs/AUDIT.md` |
| `npm run docs` | Regenerate `docs/COMMANDS.md` from the registry |
| `npm run verify` | Syntax + tests + audit in one go |

---

## Deploying 24/7

**pm2** (simplest on a VPS):

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

**Docker:**

```bash
docker compose up -d --build
docker compose logs -f
```

The Docker image installs `ffmpeg` for you. `data/` is a mounted volume so your session and database survive rebuilds.

> ⚠️ **Security:** if the panel is reachable from the internet, set `PANEL_TOKEN` in `.env`. Without it, anyone who can open the port can pair a number or wipe your session. Better still, keep the panel bound to localhost and use an SSH tunnel.

Details: [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## What this bot deliberately does NOT do

Being honest about gaps is part of the design:

- **No DRM circumvention** — Spotify, Apple Music and Tidal downloads are not implemented. Anyone claiming otherwise is usually faking it.
- **No social-media "stalking" commands** — those APIs break constantly and charge money.
- **No fake anti-* guards** — `antilink`, `antispam`, `antimedia`, `antisticker`, `antiforward`, `anticall` are real and can be enforced through Baileys. Guards that cannot be enforced reliably were left out rather than shipped as decoration.
- **No owner hierarchy theatre** — one owner list in `.env`, checked properly, instead of five overlapping ranks.

---

## License

MIT — see [`LICENSE`](LICENSE).

Built with [Baileys](https://github.com/WhiskeySockets/Baileys). Using an unofficial WhatsApp client against WhatsApp's Terms of Service carries a risk of your number being limited or banned. Use a number you can afford to lose.
