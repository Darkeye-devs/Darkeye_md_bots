# Deployment

## Option 1 — VPS with pm2 (recommended for a permanently-on bot)

```bash
sudo apt update && sudo apt install -y nodejs npm ffmpeg git
git clone <your-repo> dark-eyes-bot && cd dark-eyes-bot
npm install
cp .env.example .env && nano .env      # set OWNER_NUMBER, PANEL_TOKEN
npm start                              # pair once via http://SERVER_IP:3000
# after pairing works:
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

Keep the panel private. Two options:

```bash
# a) SSH tunnel from your laptop
ssh -L 3000:localhost:3000 user@server     # then open http://localhost:3000

# b) reverse proxy with a long random PANEL_TOKEN and HTTPS (caddy example)
panel.example.com {
  reverse_proxy localhost:3000
}
```

## Option 2 — Docker

```bash
cp .env.example .env && nano .env
docker compose up -d --build
docker compose logs -f
```

- `ffmpeg` is baked into the image.
- `./data` is mounted, so your session and database survive rebuilds.
- The healthcheck polls `/api/health`.

## Option 3 — free hosts

| Host | Fits? | Notes |
| --- | --- | --- |
| Railway / Render / Fly.io | ✅ | Persistent disk required for `data/` (session + SQLite). Set `PANEL_TOKEN`. |
| Koyeb / Northflank | ✅ | Same persistent-volume requirement. |
| Heroku | ⚠️ | Ephemeral filesystem — session dies on every restart. |
| Replit / Glitch | ❌ | Sleeps, no stable disk. Pairing breaks constantly. |

Rule of thumb: **if the filesystem resets, the session dies.** Always mount a volume at `/app/data`.

---

## Environment reference

| Variable | Default | Notes |
| --- | --- | --- |
| `BOT_NAME` | `Dark Eyes` | used in menus and captions |
| `BOT_OWNER` | `Owner` | display name only |
| `OWNER_NUMBER` | — | comma-separated international numbers, digits only |
| `PREFIX` | `.` | `.` `!` `/` `#` all work regardless |
| `BOT_MODE` | `public` | `self` = owner-only |
| `AUTO_READ` | `false` | mark messages read |
| `AUTO_TYPING` | `false` | reserved |
| `MAX_WARNS` | `3` | per group default |
| `TZ` | `Africa/Lagos` | cron + `.time` |
| `PORT` | `3000` | panel port |
| `PANEL_TOKEN` | *(empty)* | **set this on any public host** |
| `SESSION_DIR` | `data/auth` | Baileys credentials |
| `DB_PATH` | `data/darkeyes.db` | SQLite file |
| `AI_API_KEY` | — | enables 10 AI commands + optional DM auto-reply |
| `AI_BASE_URL` | `https://api.openai.com/v1` | any OpenAI-compatible endpoint |
| `AI_MODEL` | `gpt-4o-mini` | e.g. `llama-3.3-70b-versatile` on Groq |
| `AI_AUTO_REPLY` | `false` | reply to every DM with the AI |
| `DOWNLOAD_API_URL` | — | enables the 11 download commands |
| `DOWNLOAD_API_KEY` | — | sent as `Authorization: Bearer` |

---

## Free keys that actually work

**AI (free tiers):**

| Provider | `AI_BASE_URL` | Notes |
| --- | --- | --- |
| Groq | `https://api.groq.com/openai/v1` | very fast, generous free tier |
| OpenRouter | `https://openrouter.ai/api/v1` | free models with `:free` suffix |
| Together | `https://api.together.xyz/v1` | free tier on select models |
| Ollama (local) | `http://127.0.0.1:11434/v1` | no key needed, set `AI_API_KEY=ollama` |

Vision and image generation depend on the provider — set `AI_VISION_MODEL` /
`AI_IMAGE_MODEL` to a model that supports them, or those two commands will report
that the endpoint refused the request.

**Downloader (free, self-hosted):** wrap `yt-dlp` in ~20 lines and point the bot at it.

```js
// resolver.js — run with: node resolver.js
import express from 'express'
import { execFile } from 'node:child_process'
const app = express()
app.get('/resolve', (req, res) => {
  const url = req.query.url
  const wantsAudio = req.query.type === 'audio'
  const args = wantsAudio
    ? ['-f', 'bestaudio', '-g', url]
    : ['-f', 'mp4', '-g', url]
  execFile('yt-dlp', args, { timeout: 60000 }, (err, stdout) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ url: stdout.trim().split('\n').pop(), title: 'Downloaded', type: req.query.type })
  })
})
app.listen(8080)
```

Then `DOWNLOAD_API_URL=http://127.0.0.1:8080/resolve`.

Respect the terms of service of each platform — this is your responsibility, not the bot's.

---

## Operations

| Task | Command |
| --- | --- |
| Backup now | `.backup` in WhatsApp, or nightly cron (3am, keeps 7) |
| Restore | stop the bot, copy a file from `backups/` over `data/darkeyes.db`, start |
| Reload plugins | `.reload` (no restart, no dropped connection) |
| Clear a stuck session | panel → *Log out & reset session*, or `rm -rf data/auth` |
| Inspect state | `GET /api/status` |
| Run checks before deploying | `npm run verify` |

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Panel says *offline* forever | socket never opened | click *Generate QR*; check the container can reach the internet |
| Pairing code rejected | expired (60s) or wrong country code | request a new code; number must start with the country code, digits only |
| `Connection closed (401)` | session was logged out elsewhere | reset the session from the panel |
| Sticker command errors | no `ffmpeg`, or video > 6s / > 1MB | install ffmpeg, trim the clip |
| Bot silent in groups | `BOT_MODE=self`, or no admin rights for delete-based guards | check `.stats`, promote the bot |
| AI commands say "dormant" | `AI_API_KEY` missing | add it and restart (or `.reload`) |
| Everything works but downloads don't | no `DOWNLOAD_API_URL` | set the resolver above |
