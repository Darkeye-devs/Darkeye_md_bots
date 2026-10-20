import { UserError } from '../../lib/errors.js'
import { pick } from '../../lib/text.js'
import { startGame, getGame, endGame, drawHangman, maskWord } from '../../core/quiz.js'

/**
 * Games and quizzes.
 *
 * Word games draw their words from a live word API, geography quizzes from a
 * live country/capital API, and maths is computed. State lives in
 * src/core/quiz.js so `.guess` (in fun/games.js) shares it.
 */

export default [
  {
    name: 'hangman',
    aliases: ['hang'],
    category: 'fun',
    description: 'Play hangman (6 wrong guesses)',
    cooldown: 5,
    async execute(ctx) {
      const { word, source } = await ctx.services.words.randomWord({ minLength: 5, maxLength: 9 })
      startGame(ctx, { type: 'hangman', word, guessed: [], wrong: 0 })

      return ctx.reply(
        `💀 *HANGMAN*\n\n\`\`\`\n${drawHangman(0)}\n\`\`\`\n\n${maskWord(word, new Set())}\n\n` +
          `_${word.length} letters · guess with .guess <letter> · ${source}_`
      )
    }
  },

  {
    name: 'wordle',
    aliases: ['wordlegame'],
    category: 'fun',
    description: 'Guess the 5-letter word in 6 tries',
    cooldown: 5,
    async execute(ctx) {
      const { word, source } = await ctx.services.words.randomWord({ minLength: 5, maxLength: 5 })
      const target = word.length === 5 ? word : word.slice(0, 5).padEnd(5, 'e')
      startGame(ctx, { type: 'wordle', word: target, tries: [], max: 6 })

      return ctx.reply(
        `🟩 *WORDLE*\n\nGuess the 5-letter word in 6 tries.\nSend a 5-letter word with .guess <word>.\n\n` +
          `🟩 right letter, right spot\n🟨 right letter, wrong spot\n⬛ not in the word\n\n_${source}_`
      )
    }
  },

  {
    name: 'guessword',
    aliases: ['scramble'],
    category: 'fun',
    description: 'Unscramble a word',
    cooldown: 4,
    async execute(ctx) {
      const { word, source } = await ctx.services.words.randomWord({ minLength: 5, maxLength: 8 })

      let scrambled = word
      if (word.length > 1) {
        let attempt = 0
        while (scrambled === word && attempt < 20) {
          scrambled = [...word].sort(() => Math.random() - 0.5).join('')
          attempt += 1
        }
      }

      startGame(ctx, { type: 'scramble', word })
      return ctx.reply(
        `🔤 *UNSCRAMBLE*\n\n*${scrambled.toUpperCase()}*\n\n_${word.length} letters · answer with .guess <word> · ${source}_`
      )
    }
  },

  {
    name: 'mathquiz',
    aliases: ['mathsquiz', 'quizmath'],
    category: 'fun',
    description: 'Solve a random arithmetic problem',
    cooldown: 3,
    async execute(ctx) {
      const ops = ['+', '-', '×']
      const op = pick(ops)
      const a = 2 + Math.floor(Math.random() * 19)
      const b = 2 + Math.floor(Math.random() * 19)
      const answer = op === '+' ? a + b : op === '-' ? a - b : a * b

      startGame(ctx, { type: 'math', answer })
      return ctx.reply(`🧮 *MATH QUIZ*\n\n*${a} ${op} ${b} = ?*\n\n_Answer with .guess <number> (30 seconds)._`)
    }
  },

  {
    name: 'guesscapital',
    category: 'fun',
    description: 'Name the capital city of a country (live country data)',
    cooldown: 4,
    async execute(ctx) {
      const list = await ctx.services.lookup.capitals()
      if (!list.length) throw new UserError('The country API is not responding. Try again shortly.')

      const entry = pick(list)
      startGame(ctx, { type: 'capital', answer: entry.capital, country: entry.name })
      return ctx.reply(
        `🏛️ *CAPITAL QUIZ*\n\nWhat is the capital of *${entry.name}*?\n\n_Answer with .guess <city> · source: countriesnow.space_`
      )
    }
  },

  {
    name: 'guesscountry',
    category: 'fun',
    description: 'Guess the country from its capital (live country data)',
    cooldown: 4,
    async execute(ctx) {
      const list = await ctx.services.lookup.capitals()
      if (!list.length) throw new UserError('The country API is not responding. Try again shortly.')

      const entry = pick(list)
      startGame(ctx, { type: 'country', answer: entry.name, capital: entry.capital })
      return ctx.reply(
        `🌍 *COUNTRY QUIZ*\n\nWhich country has *${entry.capital}* as its capital?\n\n_Answer with .guess <country> · source: countriesnow.space_`
      )
    }
  },

  {
    name: 'guessflag',
    aliases: ['flagquiz'],
    category: 'fun',
    description: 'Guess the country from its flag',
    cooldown: 4,
    async execute(ctx) {
      const list = (await ctx.services.lookup.capitals()).filter((c) => c.iso2)
      if (!list.length) throw new UserError('The country API is not responding. Try again shortly.')

      const entry = pick(list)
      startGame(ctx, { type: 'flag', answer: entry.name })
      const url = `https://flagcdn.com/w640/${entry.iso2.toLowerCase()}.png`

      return ctx.sock.sendMessage(ctx.chat, {
        image: { url },
        caption: `🚩 *FLAG QUIZ*\n\nWhich country is this?\n\n_Answer with .guess <country> · flags: flagcdn.com_`
      })
    }
  },

  {
    name: 'riddle',
    aliases: ['riddles'],
    category: 'fun',
    description: 'A riddle to solve',
    cooldown: 4,
    async execute(ctx) {
      const r = await ctx.services.words.riddle()
      startGame(ctx, { type: 'riddle', answer: r.answer })
      return ctx.reply(`🧩 *RIDDLE*\n\n${r.question}\n\n_Answer with .guess <answer> · source: ${r.source}_`)
    }
  },

  {
    name: 'neverhaveiever',
    aliases: ['nhie'],
    category: 'fun',
    description: 'Never have I ever prompt',
    cooldown: 3,
    async execute(ctx) {
      const prompts = [
        'Never have I ever pretended to be offline to avoid someone.',
        'Never have I ever sent a message to the wrong chat and panicked.',
        'Never have I ever watched a whole series in one night.',
        'Never have I ever lied about my battery being low.',
        'Never have I ever stalked someone old profile pictures.',
        'Never have I ever eaten food that belonged to someone else in the fridge.',
        'Never have I ever fallen asleep mid-conversation.',
        'Never have I ever typed a long message and deleted it.'
      ]
      return ctx.reply(`🙈 *Never have I ever…*\n\n${pick(prompts)}\n\n_Anyone who has done it, drops a 😅 in the chat._`)
    }
  },

  {
    name: 'wordchain',
    aliases: ['chainword'],
    category: 'fun',
    description: 'Word chain — last letter becomes the first letter',
    cooldown: 3,
    async execute(ctx) {
      const { word } = await ctx.services.words.randomWord({ minLength: 4, maxLength: 7 })
      startGame(ctx, { type: 'chain', last: word, used: [word], count: 0 })

      return ctx.reply(
        `🔗 *WORD CHAIN*\n\nI start: *${word}*\n\nSend a word that starts with *${word.slice(-1).toUpperCase()}*. No repeats.\n_Use .guess <word> · expires in 5 minutes._`
      )
    }
  },

  {
    name: 'endgame',
    aliases: ['stopplay', 'giveup'],
    category: 'fun',
    description: 'End the game you are playing and reveal the answer',
    cooldown: 2,
    async execute(ctx) {
      const g = getGame(ctx)
      if (!g) throw new UserError('You are not playing anything. Start with .hangman, .wordle, .mathquiz or .riddle.')

      endGame(ctx)
      const revealed =
        g.word ?? g.answer ?? g.last ?? g.capital ?? g.country ?? 'nothing'
      return ctx.reply(`🛑 Game over. The answer was *${revealed}*.`)
    }
  }
]
