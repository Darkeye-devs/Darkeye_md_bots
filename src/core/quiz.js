import { UserError } from '../lib/errors.js'

/**
 * Shared game state for the quiz/game commands.
 *
 * This module lives outside src/plugins on purpose: the plugin loader imports
 * every plugin file with a `?v=<timestamp>` cache-buster, so a module that is
 * both a plugin AND imported by another plugin ends up with two separate
 * instances — and therefore two separate Maps. Keeping the state here means
 * `.hangman` and `.guess` always see the same store.
 */

export const games = new Map()
export const gameKey = (ctx) => `${ctx.chat}:${ctx.sender}`

const clean = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()

export function startGame(ctx, state) {
  games.set(gameKey(ctx), { ...state, expires: Date.now() + 5 * 60_000 })
  return state
}

export function getGame(ctx) {
  const g = games.get(gameKey(ctx))
  if (!g || Date.now() > g.expires) {
    games.delete(gameKey(ctx))
    return null
  }
  return g
}

export function endGame(ctx) {
  games.delete(gameKey(ctx))
}

export function drawHangman(wrong) {
  const stages = [
    '  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n========='
  ]
  return stages[Math.min(wrong, stages.length - 1)]
}

export const maskWord = (word, letters) =>
  word.split('').map((ch) => (letters.has(ch) ? ch : '_')).join(' ')

// ── grading ───────────────────────────────────────────────
/**
 * Grade a `.guess` against whatever game is running for this chat.
 * Called from the `guess` command in fun/games.js so both the old number game
 * and these games share one trigger.
 */
export async function gradeGuess(ctx, rawInput) {
  const g = getGame(ctx)
  if (!g) {
    throw new UserError('No game is running here. Start one: .hangman, .wordle, .scramble, .mathquiz, .guesscapital, .guesscountry, .guessflag, .riddle or .wordchain.')
  }

  const input = String(rawInput ?? '').trim()
  if (!input) throw new UserError('Type your answer after the command.')
  const said = clean(input)
  const finish = (text) => {
    endGame(ctx)
    return ctx.reply(text)
  }

  switch (g.type) {
    case 'hangman': {
      const letter = said.replace(/[^a-z]/g, '')[0]
      if (!letter || said.length > 2) throw new UserError('Guess one letter at a time, e.g. .guess a')

      if (g.guessed.includes(letter)) throw new UserError(`You already tried "${letter}".`)
      g.guessed.push(letter)
      if (!g.word.includes(letter)) g.wrong += 1

      const revealed = g.word.split('').every((ch) => g.guessed.includes(ch))
      if (revealed) return finish(`🎉 *Solved!* The word was *${g.word}*. ${6 - g.wrong} lives left.`)
      if (g.wrong >= 6) return finish(`💀 *Hangman.* The word was *${g.word}*.`)

      g.expires = Date.now() + 5 * 60_000
      return ctx.reply(
        `\`\`\`\n${drawHangman(g.wrong)}\n\`\`\`\n\n${maskWord(g.word, new Set(g.guessed))}\n\n` +
          `_${6 - g.wrong} lives left · tried: ${g.guessed.join(' ')}_`
      )
    }

    case 'wordle': {
      const attempt = said.replace(/[^a-z]/g, '')
      if (attempt.length !== 5) throw new UserError('Wordle guesses must be exactly 5 letters.')

      const marks = attempt.split('').map((ch, i) => {
        if (ch === g.word[i]) return '🟩'
        return g.word.includes(ch) ? '🟨' : '⬛'
      })
      const row = `${marks.join('')} ${attempt.toUpperCase()}`
      g.tries.push(row)
      g.expires = Date.now() + 5 * 60_000

      if (attempt === g.word) return finish(`${g.tries.join('\n')}\n\n🎉 *Correct!* The word was *${g.word}*.`)
      if (g.tries.length >= g.max) return finish(`${g.tries.join('\n')}\n\n😔 Out of tries. The word was *${g.word}*.`)

      return ctx.reply(`${g.tries.join('\n')}\n\n_${g.max - g.tries.length} tries left._`)
    }

    case 'scramble':
      if (said === g.word) return finish(`🎉 *Correct!* It was *${g.word}*.`)
      throw new UserError(`Not it. The word has ${g.word.length} letters and starts with "${g.word[0].toUpperCase()}".`)

    case 'math': {
      const value = Number.parseInt(input.replace(/[^-\d]/g, ''), 10)
      if (!Number.isFinite(value)) throw new UserError('Answer with a number.')
      if (value === g.answer) return finish(`✅ *Correct!* The answer is ${g.answer}.`)
      throw new UserError(`❌ Not ${value}. Try again.`)
    }

    case 'capital': {
      if (said === clean(g.answer)) return finish(`✅ *Correct!* The capital of *${g.country}* is *${g.answer}*.`)
      throw new UserError(`❌ Not ${input}. Think about *${g.country}* again.`)
    }

    case 'country': {
      if (said === clean(g.answer)) return finish(`✅ *Correct!* *${g.capital}* is the capital of *${g.answer}*.`)
      throw new UserError(`❌ Not ${input}. Which country has *${g.capital}*?`)
    }

    case 'flag': {
      if (said === clean(g.answer)) return finish(`✅ *Correct!* That flag is *${g.answer}*.`)
      throw new UserError(`❌ Not ${input}. Look at the colours and try again.`)
    }

    case 'riddle': {
      const target = clean(g.answer)
      if (said === target || (said.length > 3 && target.includes(said))) {
        return finish(`✅ *Correct!* The answer is *${g.answer}*.`)
      }
      throw new UserError('❌ Not quite. Read it again — the answer is usually literal.')
    }

    case 'chain': {
      const word = said.replace(/[^a-z]/g, '')
      if (word.length < 3) throw new UserError('Words must be at least 3 letters.')

      const expected = g.last.slice(-1)
      if (word[0] !== expected) throw new UserError(`Your word must start with *${expected.toUpperCase()}*.`)
      if (g.used.includes(word)) throw new UserError(`"${word}" was already used.`)

      g.used.push(word)
      g.count += 1
      g.expires = Date.now() + 5 * 60_000

      // Answer with a word starting with the last letter, from the live word API.
      let reply = null
      try {
        const { word: candidate } = await ctx.services.words.randomWord({ minLength: 4, maxLength: 8 })
        if (candidate.startsWith(word.slice(-1)) && !g.used.includes(candidate)) reply = candidate
      } catch {
        /* fall through to a hand-off without a word */
      }

      if (!reply) {
        return ctx.reply(`✅ *${word}* — nice. I cannot think of one starting with *${word.slice(-1).toUpperCase()}*. You win with ${g.count} words.`)
      }
      g.used.push(reply)
      g.last = reply
      return ctx.reply(`✅ *${word}* · my turn: *${reply}*\n\nYour word must start with *${reply.slice(-1).toUpperCase()}* · ${g.count} played.`)
    }

    default:
      throw new UserError('I do not know how to grade that game.')
  }
}
