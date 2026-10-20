# Architecture

Dark Eyes is split into four layers that only talk in one direction:

```
web panel ──► core/state (read-only snapshot)
                 ▲
handlers ──► router ──► plugins ──► services (db, ai, sticker, downloader…)
                 ▲
             core/registry
```

Plugins never import each other. Handlers never import plugins directly.
Everything flows through the registry and the context object.

---

## Boot sequence (`src/index.js`)

1. `ensureDirs()` — create `data/`, `logs/`, `data/tmp`, session dir.
2. `validateConfig()` — fatal problems stop the boot; warnings are logged.
3. `initDb()` — open SQLite, apply `schema.sql` (idempotent, additive).
4. Capability detection — is `ffmpeg` on PATH? are `AI_API_KEY` / `DOWNLOAD_API_URL` set?
5. `loadPlugins()` — walk `src/plugins/**`, import, validate, register.
6. `startServer()` — Express panel on `PORT`.
7. Connect to WhatsApp if a session exists; otherwise wait for the panel to pair.
8. `scheduler.start()` — reminders, nightly backup, temp cleanup.

Graceful shutdown on `SIGINT`/`SIGTERM`: stop cron, close the socket (so WhatsApp
does not hold a zombie session), close the DB.

---

## Message flow

```
messages.upsert
   └─► handlers/message.js
         ├─ parseMessage()        unwrap ephemeral/view-once, normalise JIDs
         ├─ cache the message     (anti-delete, media re-send)
         ├─ handlers/automod.js   antilink / antispam / antimedia / mute …
         │     └─ can delete + warn + remove, and stops further handling
         ├─ detectCommand()       prefix scan
         │     └─► core/router.js
         │           ├─ buildContext()      ctx object
         │           ├─ resolvePermissions() owner / admin / bot-admin
         │           ├─ runMiddleware()      mode → permissions → capabilities → cooldown
         │           └─ plugin.execute(ctx)
         └─ handlers/autoai.js    optional AI auto-reply in DMs only
```

### Why middleware is separate from plugins

A plugin author writes business logic only. Mode checks, permission checks,
capability gating, cooldowns, error formatting and usage statistics are applied
by the pipeline, so no plugin can forget them.

Order matters:

| # | Guard | Stops when |
| --- | --- | --- |
| 1 | `guardMode` | `BOT_MODE=self` and sender is not the owner (silent) |
| 2 | `guardPermissions` | owner/admin/botAdmin/group/private requirement fails |
| 3 | `guardCapabilities` | a required key or binary is missing (explains exactly what) |
| 4 | `guardCooldown` | the sender is inside a per-command cooldown |

---

## The registry

`core/registry.js` is the single source of truth for what the bot can do.

- Walks `src/plugins/` recursively; ignores files starting with `_`.
- Accepts a default export object **or** an array of plugin objects.
- Validates: `name`, `category`, `description`, `execute` are present; `name`
  matches `^[a-z0-9][a-z0-9-]*$`; `aliases` is an array.
- Rejects duplicate command names, duplicate aliases, aliases that shadow
  commands, and commands that shadow aliases.
- Records failures instead of crashing the process (`PLUGIN_STRICT=true` to fail hard in CI).
- Exposes `registryStats()` — the numbers the menu, `.stats` and the panel display.

**Capabilities** live here too: `ffmpeg`, `ai`, `downloader`. `availability(plugin)`
compares a plugin's `requires` block against them, which is how a dormant command
can explain itself.

---

## The context object (`core/context.js`)

Every plugin receives one `ctx`:

| Group | Members |
| --- | --- |
| Message | `m`, `msg`, `text`, `args`, `argsText`, `prefix`, `command` |
| Chat | `chat`, `sender`, `senderNumber`, `pushName`, `isGroup`, `mentions`, `media`, `quoted`, `quotedText`, `quotedType` |
| Permissions | `isOwner`, `isAdmin`, `isBotAdmin`, `isFromMe` |
| Replies | `reply()`, `say()`, `replyMedia()`, `react()`, `send()` |
| WhatsApp | `sock` (full Baileys socket), `download()`, `groupMeta()`, `tagAll()` |
| Services | `services.db`, `.ai`, `.sticker`, `.downloader`, `.textmaker`, `.economy`, `.scheduler` |
| Store | `db` (direct model access: users, chats, groups, warns, notes…) |

`reply()` quotes the triggering message; `say()` does not (useful for group-wide
notices where a quote adds noise).

---

## Data layer

SQLite via `better-sqlite3` — synchronous, fast, no server, one file.

| Table | Purpose |
| --- | --- |
| `chats`, `group_settings`, `members` | group state, guard toggles, welcome text, roster cache |
| `users` | command counts, last seen |
| `warns` | warnings per group per user |
| `settings` | flat key/value (bot mode, per-group badwords, reaction cache) |
| `command_stats` | usage counters for `.stats` |
| `deleted_messages` | anti-delete archive |
| `ai_memory` | per-chat conversation memory (trimmed automatically) |
| `reminders` | scheduled pings, delivered by cron |
| `economy`, `inventory` | wallets and items, scoped per chat |
| `afk`, `notes`, `todos` | personal tools |

Migrations are additive; `migrate.js` records `schema_version` and re-running is safe.

---

## Web panel (`src/web/`)

Express, no framework, no build step.

| Route | Purpose |
| --- | --- |
| `GET /api/health` | liveness for Docker healthchecks |
| `GET /api/status` | full state snapshot: status, stats, registry, capabilities |
| `GET /api/events` | Server-Sent Events: `status`, `qr`, `pairing-code`, `pairing-error`, `session-dead` |
| `POST /api/pair` | request an 8-digit pairing code for a phone number |
| `POST /api/qr` | open a socket so a QR can be generated |
| `POST /api/logout` | logout, delete the session, stop the socket |

Notes:

- SSE is used instead of WebSockets because the traffic is one-way and tiny.
- **Never name an SSE event `error`** — `EventSource` reserves that name for
  transport failures, so a data event with that name looks like a dropped stream.
  (This bug was found and fixed during development; see commit history.)
- `PANEL_TOKEN`, when set, is required on every mutating route via
  `x-panel-token` header or `?token=`. Read-only status stays open so the page renders.

---

## Reconnection & failure

`connection.js` inspects `lastDisconnect.error.output.statusCode`:

| Code | Meaning | Action |
| --- | --- | --- |
| 401 / 403 / 405 / 500 / `loggedOut` | session is dead | wipe `data/auth`, ask for a fresh pairing |
| 428, 408, 440, network | transient | exponential backoff reconnect (1s → 30s, jittered) |

The panel shows `session-dead` when the session is wiped, so you are never left
staring at a spinner wondering what happened.

---

## Testing strategy

`tests/harness.js` builds a fake Baileys socket and a real temporary SQLite
database, then calls plugin `execute()` functions directly and asserts on what
they would send.

That is why the test suite proves behaviour rather than coverage:

```
✓ .calc refuses division by zero
✓ .daily is rate-limited by a cooldown
✓ .warn removes the member at the limit
✓ tic-tac-toe blocks a winning move
✓ .todo → .todos → .donetodo → .deltodo lifecycle
```
