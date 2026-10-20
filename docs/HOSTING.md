# Hosting Dark Eyes (for users)

You do **not** need a terminal, Node, or any coding knowledge. You need three things:

1. A **Session ID** (one long string)
2. Your **owner number**
3. A host account (Render is free to start)

That's it. Total time: about 5 minutes.

---

## Step 1 — Get your Session ID

You generate this once, on the panel. Two ways:

### A. Use the hosted panel (easiest)

1. Deploy first with `SESSION_ID` left empty (see Step 2) — the bot starts without a session and the panel is live.
2. Open your app URL (e.g. `https://dark-eyes-bot.onrender.com`).
3. If you set `PANEL_TOKEN`, open it as `https://your-app.onrender.com/?token=YOUR_TOKEN`.
4. Pair with your number (QR or 8-digit code).
5. Once it says **CONNECTED**, scroll to **Session ID → Copy Session ID**.
6. Paste that value into the `SESSION_ID` environment variable on your host and redeploy.

### B. Generate locally (if you have Node on your computer)

```bash
git clone https://github.com/Darkeye-devs/Darkeye_md_bots
cd Darkeye_md_bots
npm install
npm start            # open http://localhost:3000
```

Pair, copy the Session ID, then deploy. You can delete the local copy afterwards.

> ⚠️ **A Session ID is your WhatsApp account.** Anyone who has it can read your messages.
> Never post it in a group, a screenshot, a YouTube tutorial or a GitHub issue.

---

## Step 2 — Deploy

### Render (recommended, has a free tier)

1. Go to **https://render.com/deploy?repo=https://github.com/Darkeye-devs/Darkeye_md_bots**
2. Sign in with GitHub and pick a name.
3. Fill in the two secrets:
   - `SESSION_ID` → the string you copied
   - `OWNER_NUMBER` → your number, country code first, digits only (e.g. `2348012345678`)
4. Click **Apply**. Render builds and starts the bot.
5. Watch the logs until you see `registry → 248 commands … 0 failed` and `connected as <your number>`.

**About the free tier (be realistic):** Render's free web services sleep after
~15 minutes of inactivity, and a sleeping bot cannot answer WhatsApp. For a bot
that is always on, use the **Starter** plan (~$7/month) or one of the
alternatives below. If you stay on free, ping `https://your-app.onrender.com/api/health`
every 5 minutes with a free uptime monitor — that keeps the instance awake within
Render's free-hours allowance.

### Koyeb

```bash
koyeb app init dark-eyes --git github.com/Darkeye-devs/Darkeye_md_bots --git-branch main
```
Then set `SESSION_ID`, `OWNER_NUMBER` and `PORT=8000` in the Koyeb dashboard.
`koyeb.yaml` in the repo already describes this.

### Railway

1. **New Project → Deploy from GitHub repo** → pick your fork.
2. Variables tab → add `SESSION_ID` and `OWNER_NUMBER`.
3. Railway reads `railway.json` for the start command and health check.

### Heroku / any Procfile host

```bash
heroku create your-dark-eyes
heroku config:set SESSION_ID="DarkEyes~..." OWNER_NUMBER="2348012345678"
git push heroku main
```

### Docker (VPS or anywhere)

```bash
docker build -t dark-eyes .
docker run -d --name dark-eyes --restart unless-stopped \
  -p 3000:3000 \
  -e SESSION_ID="DarkEyes~..." \
  -e OWNER_NUMBER="2348012345678" \
  dark-eyes
```

---

## Step 3 — Say hello

From your owner number, send the bot:

```
.menu
```

You should get the menu. Try `.ping`, `.stats`, `.alive`.

---

## Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `SESSION_ID` | ✅ | The string from the panel. Rebuilds the login on every boot. |
| `OWNER_NUMBER` | ✅ | Your number(s), comma-separated, digits only. Unlocks owner commands. |
| `BOT_NAME` | — | Name shown in menus (default `Dark Eyes`) |
| `PREFIX` | — | Command prefix (default `.`) |
| `BOT_MODE` | — | `public` (everyone) or `self` (owner only) |
| `PANEL_TOKEN` | — | Locks the panel. **Set this if your URL is public.** |
| `TZ` | — | Timezone for reminders and `.time` |
| `AI_API_KEY` | — | Enables 10 AI commands |
| `AI_BASE_URL` | — | Any OpenAI-compatible endpoint (Groq/OpenRouter free tiers work) |
| `DOWNLOAD_API_URL` | — | Enables the 11 download commands |

---

## Updating the bot later

Your host redeploys when you push to the repo, or when you hit **Manual Deploy**.
Because login lives in `SESSION_ID`, a redeploy does **not** log you out.

If you change `SESSION_ID` to a different account, the bot switches account.

---

## Troubleshooting

| What you see | Why | Fix |
| --- | --- | --- |
| Logs say `SESSION_ID could not be loaded` | the string got truncated when pasted | re-copy from the panel (the **Copy** button copies everything) |
| `Pairing code rejected` | code expires in ~60s | request a new one |
| Bot connects then goes silent | free tier slept | upgrade, or ping `/api/health` every 5 min |
| Panel says *This panel is locked* | `PANEL_TOKEN` is set | open `/?token=YOUR_TOKEN` once — it's remembered |
| `ECONNREFUSED`/port errors | host expects a different port | the bot uses `process.env.PORT` automatically; on Koyeb set `PORT=8000` |
| Commands reply `⚠️ dormant` | the command needs `AI_API_KEY` / `DOWNLOAD_API_URL` / `ffmpeg` | add the key, or ignore — those commands are the optional ones |
| `logged out` / `401` in logs | WhatsApp killed the session (usually paired on another device or banned) | reset and pair again, then copy a fresh Session ID |
| Nothing at all happens in groups | the bot needs admin rights for delete-based guards | promote it in the group |

---

## Is hosting this against the rules?

This bot uses an **unofficial** WhatsApp client (Baileys). That is a grey area
and technically against WhatsApp's Terms of Service, which is true of every MD
bot on GitHub. Practical advice:

- Use a number you can afford to lose — not your main business line.
- Do not mass-message strangers. That is the fastest route to a ban.
- Do not run "bulk/pair" or "auto-send to all contacts" scripts.

The bot ships without any spam tooling for exactly this reason.
