# Writing plugins

A plugin is one file exporting an object (or an array of objects). Drop it in
`src/plugins/<category>/` and restart — the registry validates and registers it.

## The full contract

```js
export default {
  // ── required ─────────────────────────────
  name: 'mycommand',              // lowercase, digits, dashes only
  category: 'tools',              // groups it in the menu
  description: 'One line that appears in .cmd',
  async execute(ctx) { /* ... */ },

  // ── optional ─────────────────────────────
  aliases: ['mc', 'mine'],        // must not collide with anything
  usage: '.mycommand <text>',     // shown in .cmd (leading dot is replaced by your prefix)
  examples: ['.mycommand hello'],
  cooldown: 5,                    // seconds, per user, owners exempt
  hidden: false,                  // true = works but is not listed in .menu
  noPrefix: false,                // true = can be triggered without a prefix

  // ── permission gates (enforced by middleware) ──
  ownerOnly: false,
  adminOnly: false,               // group admin required
  botAdminOnly: false,            // the bot itself must be admin
  groupOnly: false,
  privateOnly: false,

  // ── capability gates (enforced by middleware) ──
  requires: {
    ai: true,                     // needs AI_API_KEY
    downloader: true,             // needs DOWNLOAD_API_URL
    ffmpeg: true                  // needs the ffmpeg binary
  }
}
```

A command with an unmet `requires` is **registered but dormant**: it tells the
user exactly which key or binary is missing instead of throwing a stack trace.

## What ctx gives you

```js
async execute(ctx) {
  // identity
  ctx.chat, ctx.sender, ctx.senderNumber, ctx.pushName, ctx.isGroup

  // permissions
  ctx.isOwner, ctx.isAdmin, ctx.isBotAdmin

  // the message
  ctx.text, ctx.args, ctx.argsText, ctx.mentions
  ctx.media            // 'image' | 'video' | 'audio' | 'voice' | 'sticker' | 'document' | null
  ctx.quoted, ctx.quotedText, ctx.quotedType

  // replies
  await ctx.reply('text')                  // quotes the triggering message
  await ctx.say('text')                    // no quote (good for group notices)
  await ctx.replyMedia(buffer, 'image/png', 'caption')
  await ctx.react('👁️')

  // whatsapp
  const buffer = await ctx.download()               // media of this message
  const quoted = await ctx.download({ quoted: true }) // media of the replied-to message
  const meta = await ctx.groupMeta()
  await ctx.tagAll('message')

  // services
  ctx.services.ai.chat(ctx.chat, prompt)
  ctx.services.sticker.imageToSticker(buffer)
  ctx.services.downloader.resolve(url)
  ctx.services.economy.addCoins(ctx.chat, ctx.sender, 100)

  // database
  ctx.db.warns.add(ctx.chat, target, 'reason', ctx.sender)
  ctx.db.groups.set(ctx.chat, 'antilink', 'warn')
}
```

## Errors: let the user know without leaking internals

```js
import { UserError } from '../../lib/errors.js'

if (!ctx.args.length) {
  throw new UserError('Give me a number.', { hint: 'Example: .mycommand 42' })
}
```

- `UserError` → its message (and optional hint) is shown to the user.
- Anything else → logged with a stack trace, and the user gets a generic
  "something went sideways" message. No internals leak into chats.

## Rules that keep the bot honest

1. **Never register a command you have not implemented.** A dead button is worse than a missing one.
2. **Do not duplicate a feature to inflate counts.** If two commands do the same thing, use an alias.
3. **No fake progress.** Do not reply "downloading…" before you have a URL.
4. **Degrade honestly.** If an upstream API fails, say so — do not pretend it worked.
5. **Test it.** Add a case to `tests/commands.test.js`; the harness runs your `execute()` for real.

## Testing a plugin

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadRegistry, run } from './harness.js'

const { resolve } = await loadRegistry()

test('.mycommand greets the user', async () => {
  const ctx = await run(resolve('mycommand'), { args: ['Ada'] })
  assert.match(ctx.replies[0], /Ada/)
})
```

`run(plugin, overrides)` gives you a fake socket, a temporary SQLite database,
captured replies in `ctx.replies`, and captured reactions in `ctx.reactions`.
