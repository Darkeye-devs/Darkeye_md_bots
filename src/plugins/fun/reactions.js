import { fetchJson } from '../../lib/http.js'
import { toNumber } from '../../lib/jid.js'
import { log } from '../../core/logger.js'

const logger = log('reactions')

/**
 * Roleplay reactions backed by nekos.best — a genuinely free, key-less API
 * that returns real animated GIFs. If the API is down we degrade to a text
 * reaction instead of pretending an image was sent.
 */
const REACTIONS = {
  pat: { verb: 'pats', emoji: '🫳' },
  slap: { verb: 'slaps', emoji: '👋' },
  punch: { verb: 'punches', emoji: '👊' },
  bite: { verb: 'bites', emoji: '😬' },
  lick: { verb: 'licks', emoji: '👅' },
  cuddle: { verb: 'cuddles', emoji: '🤗' },
  poke: { verb: 'pokes', emoji: '👉' },
  tickle: { verb: 'tickles', emoji: '🪶' },
  wave: { verb: 'waves at', emoji: '👋' },
  wink: { verb: 'winks at', emoji: '😉' },
  smile: { verb: 'smiles at', emoji: '🙂' },
  laugh: { verb: 'laughs with', emoji: '😂' },
  cry: { verb: 'cries with', emoji: '😢' },
  blush: { verb: 'blushes at', emoji: '😊' },
  dance: { verb: 'dances with', emoji: '💃' },
  sleep: { verb: 'sleeps next to', emoji: '😴' },
  eat: { verb: 'eats with', emoji: '🍽️' },
  drink: { verb: 'drinks with', emoji: '🍹' },
  cook: { verb: 'cooks for', emoji: '🍳' },
  angry: { verb: 'is angry at', emoji: '😠' },
  happy: { verb: 'is happy with', emoji: '😄' },
  sad: { verb: 'is sad with', emoji: '😔' },
  bored: { verb: 'is bored with', emoji: '😐' },
  shy: { verb: 'is shy around', emoji: '😳' },
  scared: { verb: 'is scared of', emoji: '😨' },
  surprised: { verb: 'is surprised by', emoji: '😲' },
  confused: { verb: 'is confused by', emoji: '😕' },
  think: { verb: 'thinks about', emoji: '🤔' },
  nod: { verb: 'nods at', emoji: '🙂' },
  shrug: { verb: 'shrugs at', emoji: '🤷' },
  highfive: { verb: 'high-fives', emoji: '🙌' },
  handhold: { verb: 'holds hands with', emoji: '🤝' },
  bully: { verb: 'bullies', emoji: '😈' },
  nom: { verb: 'noms with', emoji: '😋' },
  cringe: { verb: 'cringes at', emoji: '😬' },
  pout: { verb: 'pouts at', emoji: '😤' },
  smug: { verb: 'smugs at', emoji: '😏' },
  yawn: { verb: 'yawns at', emoji: '🥱' }
}

/** nekos.best endpoint names differ slightly from ours. */
const ENDPOINTS = { handhold: 'handhold', highfive: 'highfive', bully: 'baka', punch: 'punch', nom: 'nom', think: 'think' }

async function fetchGif(action) {
  const endpoint = ENDPOINTS[action] ?? action
  try {
    const data = await fetchJson(`https://nekos.best/api/v2/${endpoint}`, { timeout: 8000, retries: 0 })
    const result = data?.results?.[0]
    return result?.url ?? null
  } catch (error) {
    logger.debug('nekos.best %s failed: %s', endpoint, error.message)
    return null
  }
}

const plugins = Object.entries(REACTIONS).map(([name, spec]) => ({
  name,
  category: 'fun',
  description: `${spec.emoji} ${spec.verb} someone`,
  usage: `.${name} @user`,
  cooldown: 3,
  status: 'unstable',
  async execute(ctx) {
    const target = ctx.mentions[0] ?? ctx.quoted?.key?.participant ?? null
    const targetLabel = target ? `@${toNumber(target)}` : 'the air'
    const actor = `@${ctx.senderNumber}`

    const gif = await fetchGif(name)
    const caption = target
      ? `${actor} ${spec.verb} ${targetLabel} ${spec.emoji}`
      : `${actor} ${spec.verb} ${targetLabel} ${spec.emoji}`

    if (!gif) {
      // Honest fallback: no fake "sending gif…" — just the text reaction.
      return ctx.say({ text: caption, mentions: target ? [target] : [] })
    }

    return ctx.sock.sendMessage(
      ctx.chat,
      { video: { url: gif }, gifPlayback: true, caption, mentions: target ? [target] : [] },
      { quoted: ctx.raw }
    )
  }
}))

export default plugins
