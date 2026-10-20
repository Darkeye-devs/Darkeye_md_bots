# 🔌 Where the data comes from

Every command that presents *data* fetches it from a real API at the moment you
use it. Nothing in this repo is a hardcoded list dressed up as a live feature.

Two honest categories:

| Kind | Meaning | Example |
| --- | --- | --- |
| **Live API** | the answer comes from the internet, and changes between calls | `.weather`, `.joke`, `.trivia`, `.crypto`, `.sticker` |
| **Local computation** | the answer is genuinely computed by the bot, offline | `.calc`, `.chess`, `.wordle`, `.ship`, `.8ball`, `.truth`, `.romon` |

`.8ball`, `.truth`, `.dare`, `.wyr` and `.fortune` are deliberately local: they
are *prompt generators*, not lookups. There is no API for "would you rather"
questions, and a game that breaks when your Wi-Fi drops is a worse game.

## Commands that talk to a real API

| Service | Endpoint | Key? | Free tier |
| --- | --- | --- | --- |
| Jokes | `icanhazdadjoke.com` → `official-joke-api.appspot.com` fallback | **no** | unlimited, rate-friendly |
| Facts | `uselessfacts.jsph.pl` | **no** | unlimited |
| Quotes | `zenquotes.io` | **no** | 5 req / 30 s per IP (cached for 2 min in the bot) |
| Trivia | `opentdb.com` | **no** | open, no quota advertised |
| Weather + geocoding | `api.open-meteo.com`, `geocoding-api.open-meteo.com` | **no** | generous, non-commercial |
| Dictionary | `api.dictionaryapi.dev` | **no** | unlimited |
| IP lookup | `ipapi.co` | **no** | 1 000 req/day per IP |
| Exchange rates | `open.er-api.com` | **no** | free, daily refresh |
| Crypto prices | `api.coingecko.com` | **no** | 30 calls/min without a key |
| Translate | `translate.googleapis.com` (unofficial) | **no** | unofficial endpoint — can throttle |
| URL shortener | `is.gd` | **no** | free |
| Anime / reaction GIFs | `nekos.best` | **no** | free |
| QR codes | generated on-device | **no** | — |
| WHOIS / DNS / RDAP | registry endpoints via `dns` + `rdap.org` | **no** | free |

## Services that need a key you provide

| Service | Env var | Free tier? |
| --- | --- | --- |
| Any OpenAI-compatible LLM | `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | **depends on provider.** Groq, Google AI Studio, Cerebras, OpenRouter (free models) and Ollama (local) all have free tiers. OpenAI itself is paid. |
| AI image generation | `AI_IMAGE_MODEL` (via the same endpoint) | usually paid |

Nothing in the bot requires a paid key. `.ai`, `.imagine` and `.describe` are the
only commands that want one, and they tell you exactly which variable is missing
instead of failing silently.

## How failures are reported

An API that is down produces a clear message ("the fact API is not answering
right now") — never an invented answer. The only exception is `.trivia`, which
falls back to a small built-in question set and labels it `offline question`, so
a quiz can continue mid-game.

Tests in `tests/content.test.js` stub the network and assert both directions:
the happy path parses real payloads, and the failure path *refuses to fake data*.

## Adding a data command

```js
import { fetchJson } from '../../lib/http.js'

async execute(ctx) {
  const data = await fetchJson('https://api.example.com/thing')   // has timeout + 1 retry
  return ctx.reply(data.value)
}
```

Rules of the house:

1. No key required unless there is genuinely no alternative — then document it here.
2. No hardcoded data lists for anything that exists as an API.
3. On failure, throw a `UserError` with a human message. Never invent a result.
