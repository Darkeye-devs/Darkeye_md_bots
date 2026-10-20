# Split deployment: frontend on Vercel, backend on Render

Yes — this is the recommended setup for a public bot site. The two halves do
different jobs:

| Half | Host | What it runs | Why |
| --- | --- | --- | --- |
| **Frontend** | Vercel | static SPA from `landing/` | free, global CDN, instant deploys, HTTPS |
| **Backend** | Render / Koyeb / Railway | `src/index.js` (Node + Baileys + SQLite) | needs a long-lived process and a real filesystem |

Vercel **cannot** run the bot itself: serverless functions have no persistent
WhatsApp socket, no SQLite file, and a 10-second limit on hobby plan. So the
bot lives on Render; the pretty site lives on Vercel; they talk over HTTPS.

```
   user ──► dark-eyes.vercel.app      (static site, pairs + shows Session ID)
                     │
                     │  fetch() with CORS
                     ▼
            dark-eyes-bot.onrender.com  (Baileys socket, SQLite, /api/public/*)
                     │
                     ▼
                 WhatsApp servers
```

---

## 1. Deploy the backend (Render)

1. **New → Web Service → Build from Git repo** → `Darkeye-devs/Darkeye_md_bots`.
2. Render reads `render.yaml`. Start command is `node src/index.js`.
3. Add these environment variables:

| Key | Value |
| --- | --- |
| `OWNER_NUMBER` | your number, digits only |
| `SESSION_ID` | leave empty the first time (you will generate it) |
| `CORS_ORIGINS` | your Vercel URL, e.g. `https://dark-eyes.vercel.app` |
| `PANEL_TOKEN` | a long random string (Render can generate it) |

4. Deploy. Check `https://YOUR-APP.onrender.com/api/health` returns `{"ok":true}`.

> `CORS_ORIGINS` accepts a comma-separated list. Use `*` only while testing.

---

## 2. Deploy the frontend (Vercel)

### Option A — dashboard (no CLI)

1. **Add New → Project → Import** the same GitHub repo.
2. Set **Root Directory** to `landing`.
3. Framework preset: **Vite** (auto-detected). Build `vite build`, output `dist`.
4. Add an environment variable:

| Key | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://YOUR-APP.onrender.com` (no trailing slash) |

5. **Deploy**. Vercel gives you `https://dark-eyes-xxxx.vercel.app`.

### Option B — CLI

```bash
cd landing
npm install
echo "VITE_API_BASE_URL=https://YOUR-APP.onrender.com" > .env
npx vercel --prod        # or: npx vercel link && npx vercel --prod
```

### Then finish the loop

- Go back to Render → set `CORS_ORIGINS` to your Vercel URL → redeploy.
- Open the Vercel site, pair a number, copy the Session ID.
- Paste it as `SESSION_ID` on Render and redeploy. The bot is now permanently paired.

---

## 3. How the public pairing flow works

The landing page is public, so the API it calls is deliberately narrow:

| Endpoint | Purpose | Guard |
| --- | --- | --- |
| `POST /api/public/pair` | request an 8-digit pairing code | rate limit: 6 per IP per hour |
| `GET /api/public/pair/:phone` | poll status (code, expiry, connected?) | returns no secrets |
| `POST /api/public/session` | redeem the Session ID | requires the opaque `pairToken` issued by step 1 |

- The `pairToken` is 24 random bytes, shown only to the browser that asked.
- A Session ID can be claimed **once**; the second attempt returns `410 Gone`.
- Only **one pairing at a time** is allowed, because one process can only hold one
  WhatsApp socket. A second request gets `409` with the seconds remaining.
- Abandoned pairings are cleaned up after 15 minutes.
- If WhatsApp returns no code (number not on WhatsApp, no country code), the
  socket is released immediately and the user gets a plain-English `422`.

### Extra hardening for a public site

- `PANEL_TOKEN` still protects the owner panel (`/api/status`, `/api/session`,
  `/api/logout`). The public routes never expose those.
- Set `BOT_MODE=public` only after you have your own Session ID — otherwise a
  stranger could pair your bot instance first.
- If you do not want a public site at all, just skip Vercel: the bot panel on
  Render already does pairing for the owner.

---

## 4. Local development of the split

```bash
# terminal 1 — backend
npm install && npm start                 # http://localhost:3000

# terminal 2 — frontend
cd landing && npm install
echo "VITE_API_BASE_URL=http://localhost:3000" > .env
npm run dev                              # http://localhost:5173
```

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Browser console: *blocked by CORS policy* | Render's `CORS_ORIGINS` doesn't include the Vercel URL | add the exact origin (scheme + host, no trailing slash) |
| Landing page hangs on "Requesting…" | backend cold-starting on a free tier | wait ~30s; the page pings `/api/health` on load to wake it |
| `422 … did not return a pairing code` | number not on WhatsApp, or missing country code | fix the number, retry after a minute |
| `409 Another pairing is in progress` | someone else is mid-pairing | the message tells you how long to wait |
| Session ID works locally but not on Render | the value was truncated on paste | re-copy with the **Copy** button |
| Landing page shows old content | Vercel cached the build | redeploy with **Redeploy → Clear cache** |
