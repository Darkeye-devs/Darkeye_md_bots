import { UserError } from '../../lib/errors.js'
import { config } from '../../config/index.js'
import { truncate } from '../../lib/text.js'
import { log } from '../../core/logger.js'

const logger = log('ai')

/** One-shot AI tasks: the instruction is fixed, the input comes from the chat. */
const TASKS = {
  summarize: {
    aliases: ['summary', 'tldr'],
    description: 'Summarise a long message or text',
    usage: '.summarize (reply to a message)',
    instruction: 'Summarise the following in 4 short bullet points. Keep the key facts.',
    input: (ctx) => ctx.quotedText || ctx.argsText
  },
  explain: {
    aliases: ['eli5', 'simplify'],
    description: 'Explain something in plain language',
    usage: '.explain quantum entanglement',
    instruction: 'Explain this clearly to a curious beginner, in under 120 words. Use one analogy.',
    input: (ctx) => ctx.argsText || ctx.quotedText
  },
  rewrite: {
    aliases: ['paraphrase', 'improve'],
    description: 'Rewrite text to sound better',
    usage: '.rewrite (reply to a message)',
    instruction: 'Rewrite the following so it is clearer and more natural. Return only the rewritten text.',
    input: (ctx) => ctx.quotedText || ctx.argsText
  },
  grammar: {
    aliases: ['proofread', 'spellcheck', 'fix'],
    description: 'Fix spelling and grammar',
    usage: '.grammar (reply to a message)',
    instruction: 'Correct the spelling and grammar. Return only the corrected text, no commentary.',
    input: (ctx) => ctx.quotedText || ctx.argsText
  },
  code: {
    aliases: ['codegen', 'debug'],
    description: 'Write or fix code',
    usage: '.code a python function that reverses a string',
    instruction: 'Write clean, working code for this request. Explain briefly after the code block.',
    input: (ctx) => ctx.argsText || ctx.quotedText
  },
  story: {
    aliases: ['write', 'poem'],
    description: 'Write a short creative piece',
    usage: '.story a robot who is afraid of the dark',
    instruction: 'Write a short creative piece (max 200 words) based on this prompt.',
    input: (ctx) => ctx.argsText
  }
}

const taskPlugins = Object.entries(TASKS).map(([name, task]) => ({
  name,
  aliases: task.aliases,
  category: 'ai',
  description: task.description,
  usage: task.usage,
  requires: { ai: true },
  cooldown: 8,
  async execute(ctx) {
    const input = task.input(ctx)
    if (!input) throw new UserError('I need some text — reply to a message or type it after the command.')
    if (input.length > 6000) throw new UserError('That is a lot of text. Trim it under 6000 characters.')

    await ctx.react('🧠')
    const answer = await ctx.services.ai.complete(task.instruction, input)
    return ctx.reply(answer)
  }
}))

export default [
  {
    name: 'ai',
    aliases: ['ask', 'chat', 'gpt', 'bot', 'gemini'],
    category: 'ai',
    description: 'Talk to the configured AI model (remembers this chat)',
    usage: '.ai your question',
    requires: { ai: true },
    cooldown: 4,
    async execute(ctx) {
      const prompt = ctx.argsText || ctx.quotedText
      if (!prompt) {
        return ctx.reply(
          `🧠 I am listening. Ask me anything.\n\n_Model: ${config.ai.model}_\n_Clear my memory: ${ctx.prefix}forget_`
        )
      }

      await ctx.sock.sendPresenceUpdate('composing', ctx.chat).catch(() => {})
      try {
        const answer = await ctx.services.ai.chat(ctx.chat, prompt, { sender: ctx.sender })
        return ctx.reply(answer)
      } finally {
        await ctx.sock.sendPresenceUpdate('paused', ctx.chat).catch(() => {})
      }
    }
  },

  ...taskPlugins,

  {
    name: 'forget',
    aliases: ['clearmemory', 'resetai'],
    category: 'ai',
    description: 'Clear the AI memory for this chat',
    cooldown: 5,
    async execute(ctx) {
      const removed = ctx.services.ai.clearMemory(ctx.chat)
      return ctx.reply(removed ? `🧠 Forgot ${removed} stored message(s) from this chat.` : '🧠 There was nothing to forget.')
    }
  },

  {
    name: 'imagine',
    aliases: ['dalle', 'imagegen', 'draw'],
    category: 'ai',
    description: 'Generate an image from a description',
    usage: '.imagine a cyberpunk eye in the rain',
    requires: { ai: true },
    cooldown: 25,
    async execute(ctx) {
      const prompt = ctx.argsText
      if (!prompt) throw new UserError('Describe the image you want.') 

      await ctx.react('🎨')
      const buffer = await ctx.services.ai.image(prompt)
      return ctx.replyMedia(buffer, 'image/png', `🎨 *${truncate(prompt, 120)}*`)
    }
  },

  {
    name: 'describe',
    aliases: ['vision', 'whatisthis', 'seeimage'],
    category: 'ai',
    description: 'Let the AI look at an image and describe it',
    usage: '.describe (reply to an image)',
    requires: { ai: true },
    cooldown: 10,
    async execute(ctx) {
      const isImage = ctx.media === 'image' || ctx.quotedType === 'image'
      if (!isImage) throw new UserError('Reply to an image and I will look at it.')
      const buffer = ctx.media === 'image' ? await ctx.download() : await ctx.download({ quoted: true })
      if (!buffer) throw new UserError('Could not read that image.')

      const prompt = ctx.argsText || 'Describe this image in detail. Mention any text you can read.'
      await ctx.react('👁️')
      try {
        const answer = await ctx.services.ai.vision(buffer, prompt)
        return ctx.reply(answer)
      } catch (error) {
        logger.error('vision failed: %s', error.message)
        throw new UserError('The vision model is unavailable.', {
          hint: 'Your AI endpoint may not support image input — set AI_VISION_MODEL to one that does.'
        })
      }
    }
  }
]
