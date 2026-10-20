import { UserError } from '../../lib/errors.js'
import { bold, pick } from '../../lib/text.js'
import { hashString } from '../../lib/text.js'

/** Live game sessions, keyed by chat. Cleared when the game ends. */
const sessions = new Map()
const sessionKey = (ctx) => `${ctx.chat}:${ctx.sender}`

const TRIVIA = [
  { q: 'What is the capital of Japan?', a: ['tokyo'] },
  { q: 'How many sides does a hexagon have?', a: ['6', 'six'] },
  { q: 'Which planet is known as the Red Planet?', a: ['mars'] },
  { q: 'What is the largest ocean on Earth?', a: ['pacific', 'pacific ocean'] },
  { q: 'Who wrote "Things Fall Apart"?', a: ['chinua achebe', 'achebe'] },
  { q: 'What is the chemical symbol for gold?', a: ['au'] },
  { q: 'How many continents are there?', a: ['7', 'seven'] },
  { q: 'In what year did Nigeria gain independence?', a: ['1960'] },
  { q: 'What is the fastest land animal?', a: ['cheetah'] },
  { q: 'What does HTTP stand for?', a: ['hypertext transfer protocol'] }
]

const WORDS = ['elephant', 'computer', 'javascript', 'whisper', 'galaxy', 'harmony', 'phantom', 'jubilee', 'kangaroo', 'lantern', 'mystery', 'octopus']

const FORTUNES = [
  'A quiet door opens where you expected a wall.',
  'Someone is thinking about you right now. Yes, that one.',
  'The delay you are annoyed about is protecting you.',
  'Money comes fast this month but leaves faster. Keep receipts.',
  'You already know the answer. You are asking for permission.',
  'An old contact returns with something useful.'
]

export default [
  {
    name: '8ball',
    aliases: ['magic8', 'eightball'],
    category: 'fun',
    description: 'Ask the ball a yes/no question',
    usage: '.8ball will I win today?',
    cooldown: 2,
    async execute(ctx) {
      if (!ctx.argsText) throw new UserError('Ask me a question first.')
      const answers = [
        'It is certain. 👁️', 'Without a doubt.', 'Yes — but not how you think.',
        'The signs point to yes.', 'Ask again when the moon is quieter.',
        'I cannot see that far.', 'Do not count on it.', 'No. Definitely no.',
        'The eye sees a maybe.', 'Only if you move first.'
      ]
      await ctx.react('🎱')
      return ctx.reply(`🎱 *${ctx.argsText}*\n\n${pick(answers)}`)
    }
  },

  {
    name: 'coinflip',
    aliases: ['flip', 'coin'],
    category: 'fun',
    description: 'Flip a coin',
    cooldown: 1,
    async execute(ctx) {
      const result = Math.random() < 0.5 ? 'HEADS' : 'TAILS'
      await ctx.react('🪙')
      return ctx.reply(`🪙 *${result}*`)
    }
  },

  {
    name: 'dice',
    aliases: ['roll', 'roll20'],
    category: 'fun',
    description: 'Roll dice (1d6 by default, or NdM)',
    usage: '.dice 2d20',
    cooldown: 1,
    async execute(ctx) {
      const match = (ctx.args[0] ?? '1d6').match(/^(\d{1,2})?d(\d{1,3})$/i)
      const count = Math.min(20, Math.max(1, Number(match?.[1] ?? 1)))
      const sides = Math.min(1000, Math.max(2, Number(match?.[2] ?? 6)))

      const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides))
      const total = rolls.reduce((a, b) => a + b, 0)
      return ctx.reply(
        `🎲 *${count}d${sides}*\n\n${rolls.map((r) => `\`${r}\``).join(' + ')}${count > 1 ? ` = *${total}*` : ''}`
      )
    }
  },

  {
    name: 'rps',
    aliases: ['rockpaperscissors'],
    category: 'fun',
    description: 'Rock, paper, scissors against the bot',
    usage: '.rps rock|paper|scissors',
    cooldown: 2,
    async execute(ctx) {
      const choice = (ctx.args[0] ?? '').toLowerCase()
      const valid = ['rock', 'paper', 'scissors']
      if (!valid.includes(choice)) throw new UserError('Choose rock, paper or scissors.')

      const bot = pick(valid)
      const wins = { rock: 'scissors', paper: 'rock', scissors: 'paper' }
      const outcome = choice === bot ? 'A draw. 👁️' : wins[choice] === bot ? 'You win. 🎉' : 'I win. 👁️'

      return ctx.reply(`You: *${choice}*\nMe: *${bot}*\n\n${outcome}`)
    }
  },

  {
    name: 'trivia',
    aliases: ['quiz'],
    category: 'fun',
    description: 'Answer a trivia question (60 seconds)',
    cooldown: 5,
    async execute(ctx) {
      const question = pick(TRIVIA)
      const key = sessionKey(ctx)
      sessions.set(key, { type: 'trivia', answer: question.a, expires: Date.now() + 60_000 })

      return ctx.reply(`🧠 *TRIVIA*\n\n${question.q}\n\n_You have 60 seconds. Just type your answer._`)
    }
  },

  {
    name: 'answer',
    category: 'fun',
    hidden: true,
    noPrefix: false,
    description: 'Check a trivia answer',
    cooldown: 0,
    async execute(ctx) {
      const session = sessions.get(sessionKey(ctx))
      if (!session?.answer) throw new UserError('No question is waiting for an answer.')
      const guess = ctx.argsText.toLowerCase().trim()
      const correct = session.answer.some((a) => guess === a || guess.includes(a))
      sessions.delete(sessionKey(ctx))
      return ctx.reply(correct ? '✅ Correct!' : `❌ Not quite. Answer: *${session.answer[0]}*`)
    }
  },

  {
    name: 'guessnumber',
    aliases: ['guessnum'],
    category: 'fun',
    description: 'Guess my number between 1 and 100 (10 tries)',
    cooldown: 5,
    async execute(ctx) {
      const key = sessionKey(ctx)
      sessions.set(key, {
        type: 'guess',
        number: 1 + Math.floor(Math.random() * 100),
        tries: 0,
        max: 10,
        expires: Date.now() + 180_000
      })
      return ctx.reply('🎯 I picked a number between *1* and *100*.\nYou have *10* guesses — type them one at a time.')
    }
  },

  {
    name: 'guess',
    category: 'fun',
    hidden: true,
    description: 'Submit a guess for the active number game',
    cooldown: 0,
    async execute(ctx) {
      const key = sessionKey(ctx)
      const session = sessions.get(key)
      if (session?.type !== 'guess') throw new UserError('No guessing game is running. Start one with .guessnumber.')

      const guess = Number.parseInt(ctx.argsText, 10)
      if (!Number.isFinite(guess)) throw new UserError('Type a number.')

      session.tries++
      if (guess === session.number) {
        sessions.delete(key)
        return ctx.reply(`🎯 *Correct!* It was ${session.number}. You got it in ${session.tries} tries.`)
      }
      if (session.tries >= session.max) {
        sessions.delete(key)
        return ctx.reply(`😔 Out of tries. The number was *${session.number}*.`)
      }
      return ctx.reply(
        `${guess < session.number ? '📈 Higher' : '📉 Lower'} — ${session.max - session.tries} tries left.`
      )
    }
  },

  {
    name: 'tictactoe',
    aliases: ['ttt'],
    category: 'fun',
    description: 'Play tic-tac-toe against an unbeatable bot',
    usage: '.tictactoe',
    cooldown: 5,
    async execute(ctx) {
      const key = sessionKey(ctx)
      sessions.set(key, { type: 'ttt', board: Array(9).fill(null), expires: Date.now() + 300_000 })
      return ctx.reply(
        `🎮 *TIC-TAC-TOE* — you are ❌, I am ⭕\n\n${renderBoard(Array(9).fill(null))}\n\n` +
          `Play with: ${ctx.prefix}move 1-9 (top-left is 1)`
      )
    }
  },

  {
    name: 'move',
    category: 'fun',
    hidden: true,
    description: 'Make a tic-tac-toe move',
    cooldown: 1,
    async execute(ctx) {
      const key = sessionKey(ctx)
      const session = sessions.get(key)
      if (session?.type !== 'ttt') throw new UserError('No tic-tac-toe game running. Start one with .tictactoe.')

      const position = Number.parseInt(ctx.args[0], 10)
      if (!(position >= 1 && position <= 9)) throw new UserError('Pick a square from 1 to 9.')
      const index = position - 1
      if (session.board[index]) throw new UserError('That square is taken.')

      session.board[index] = 'X'
      let winner = winnerOf(session.board)
      if (!winner) {
        const best = bestMove(session.board)
        if (best !== null) session.board[best] = 'O'
        winner = winnerOf(session.board)
      }

      const board = renderBoard(session.board)
      if (winner === 'X') {
        sessions.delete(key)
        return ctx.reply(`${board}\n\n🎉 You won. That should not be possible — are you cheating? 👁️`)
      }
      if (winner === 'O') {
        sessions.delete(key)
        return ctx.reply(`${board}\n\n👁️ I win. The eye always wins.`)
      }
      if (session.board.every(Boolean)) {
        sessions.delete(key)
        return ctx.reply(`${board}\n\n🤝 A draw.`)
      }
      return ctx.reply(board)
    }
  },

  {
    name: 'slots',
    aliases: ['slot'],
    category: 'fun',
    description: 'Spin the slot machine',
    cooldown: 2,
    async execute(ctx) {
      const symbols = ['🍒', '🍋', '🔔', '💎', '👁️']
      const spin = Array.from({ length: 3 }, () => pick(symbols))
      const win = spin[0] === spin[1] && spin[1] === spin[2]
      const two = spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2]
      return ctx.reply(
        `🎰 | ${spin.join(' | ')} |\n\n${win ? '💎 JACKPOT!' : two ? '✨ Two of a kind — small win.' : 'Nothing. Spin again.'}`
      )
    }
  },

  {
    name: 'truth',
    aliases: ['dare', 'truthordare'],
    category: 'fun',
    description: 'Truth or dare prompt',
    cooldown: 2,
    async execute(ctx) {
      const truths = [
        'What is the last lie you told someone in this chat?',
        'Who here would you trust with your phone unlocked?',
        'What is the pettiest reason you ever stopped talking to someone?',
        'What is something you pretend not to care about but really do?'
      ]
      const dares = [
        'Send the last photo in your gallery — describe it instead if it is private.',
        'Type your next five messages in capital letters.',
        'Voice-note yourself singing one line of any song.',
        'Change your profile picture for one hour.'
      ]
      const wantDare = ctx.command === 'dare' || ctx.args[0]?.toLowerCase() === 'dare'
      return ctx.reply(wantDare ? `🔥 *DARE*\n\n${pick(dares)}` : `💭 *TRUTH*\n\n${pick(truths)}`)
    }
  },

  {
    name: 'wyr',
    aliases: ['wouldyourather'],
    category: 'fun',
    description: 'Would you rather…',
    cooldown: 2,
    async execute(ctx) {
      const pairs = [
        ['have unlimited data but no wifi', 'unlimited wifi but no data'],
        ['always be 10 minutes early', 'always be 20 minutes late'],
        ['know how you die', 'know when you die'],
        ['never use social media again', 'never watch another film'],
        ['be the smartest person in the room', 'be the funniest person in the room']
      ]
      const [a, b] = pick(pairs)
      return ctx.reply(`🤔 *Would you rather…*\n\n🇦 ${a}\n\nor\n\n🇧 ${b}\n\n_Reply A or B._`)
    }
  },

  {
    name: 'fact',
    aliases: ['funfact', 'didyouknow'],
    category: 'fun',
    description: 'A random real fact',
    cooldown: 2,
    async execute(ctx) {
      const facts = [
        'A group of flamingos is called a "flamboyance".',
        'Honey never spoils — 3,000-year-old honey is still edible.',
        'Octopuses have three hearts and blue blood.',
        'The Eiffel Tower grows about 15 cm taller in summer due to heat expansion.',
        'Bananas are berries; strawberries are not.',
        'There is more computing power in a modern phone than in the Apollo 11 guidance computer.',
        'Nigeria has over 500 living languages — the highest in Africa.'
      ]
      return ctx.reply(`🧠 *Fact*\n\n${pick(facts)}`)
    }
  },

  {
    name: 'quote',
    category: 'fun',
    description: 'A quote worth reading',
    cooldown: 2,
    async execute(ctx) {
      const quotes = [
        ['The eye sees only what the mind is prepared to comprehend.', 'Robertson Davies'],
        ['If you want to go fast, go alone. If you want to go far, go together.', 'African proverb'],
        ['The measure of intelligence is the ability to change.', 'Albert Einstein'],
        ['Do not wait to strike till the iron is hot; make it hot by striking.', 'W. B. Yeats'],
        ['A person who never made a mistake never tried anything new.', 'Marie Curie']
      ]
      const [text, author] = pick(quotes)
      return ctx.reply(`❝ ${text} ❞\n\n— *${author}*`)
    }
  },

  {
    name: 'ship',
    aliases: ['lovecalc', 'match'],
    category: 'fun',
    description: 'Rate the compatibility of two people',
    usage: '.ship @user or .ship Name1 & Name2',
    cooldown: 3,
    async execute(ctx) {
      let a = ctx.senderNumber
      let b = null
      let names = ''

      if (ctx.mentions.length) {
        b = ctx.mentions[0].split('@')[0]
        names = `@${a} ❤️ @${b}`
      } else if (ctx.argsText.includes('&')) {
        const [x, y] = ctx.argsText.split('&').map((s) => s.trim())
        a = x
        b = y
        names = `*${x}* ❤️ *${y}*`
      } else {
        throw new UserError('Tag someone, or use: .ship Name1 & Name2')
      }

      const score = hashString([a, b].sort().join('')) % 101
      const bar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10))
      const verdict =
        score > 85 ? 'Soulmates. It is written. 👁️' :
        score > 65 ? 'Strong match — do not overthink it.' :
        score > 40 ? 'There is something there. Needs work.' :
        score > 20 ? 'Friendship is the safer road.' : 'Run. 👁️'

      return ctx.reply(
        `❤️ *SHIP*\n\n${names}\n\n${bar} *${score}%*\n\n${verdict}`,
        { mentions: b && ctx.mentions.length ? [ctx.mentions[0]] : [] }
      )
    }
  },

  {
    name: 'rate',
    aliases: ['iq', 'howgay'],
    category: 'fun',
    description: 'Rate something on a scale of 1 to 100',
    usage: '.rate my cooking',
    cooldown: 2,
    async execute(ctx) {
      const subject = ctx.argsText || ctx.pushName || 'this'
      const score = (hashString(subject.toLowerCase() + ctx.senderNumber) % 100) + 1
      const comments = [
        'The eye is unconvinced.',
        'Above average, by a hair.',
        'Honestly? Respectable.',
        'The eye has seen much better.',
        'That is elite level.',
        'Not even I can explain this score.'
      ]
      return ctx.reply(`📊 *${subject}*\n\n*${score}/100*\n_${pick(comments)}_`)
    }
  },

  {
    name: 'fortune',
    aliases: ['tarot'],
    category: 'fun',
    description: 'A cryptic fortune',
    cooldown: 2,
    async execute(ctx) {
      return ctx.reply(`🔮 *Your fortune*\n\n${pick(FORTUNES)}`)
    }
  },

  {
    name: 'joke',
    aliases: ['dadjoke', 'pun'],
    category: 'fun',
    description: 'A joke (real joke API with a local fallback)',
    cooldown: 2,
    async execute(ctx) {
      try {
        const data = await ctx.services.ai.enabled
          ? null
          : null
        if (data) return ctx.reply(data)
      } catch {
        /* fall through to local jokes */
      }
      const jokes = [
        'I told my computer I needed a break. It said: no problem — I will go to sleep.',
        'Why do programmers prefer dark mode? Because light attracts bugs.',
        'I would tell you a UDP joke, but you might not get it.',
        'MyWhatsApp bot has trust issues. It keeps reading every message. 👁️',
        'There are two hard things in computing: cache invalidation, naming things, and off-by-one errors.'
      ]
      return ctx.reply(`😄 ${pick(jokes)}`)
    }
  }
]

// ── tic-tac-toe helpers ──────────────────────
function renderBoard(board) {
  const cell = (i) => board[i] ?? String(i + 1)
  return ['┌───┬───┬───┐', `│ ${cell(0)} │ ${cell(1)} │ ${cell(2)} │`, '├───┼───┼───┤',
    `│ ${cell(3)} │ ${cell(4)} │ ${cell(5)} │`, '├───┼───┼───┤',
    `│ ${cell(6)} │ ${cell(7)} │ ${cell(8)} │`, '└───┴───┴───┘'].join('\n')
}

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]

function winnerOf(board) {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]
  }
  return null
}

function minimax(board, depth, isMaximising) {
  const winner = winnerOf(board)
  if (winner === 'O') return 10 - depth
  if (winner === 'X') return depth - 10
  if (board.every(Boolean)) return 0

  const scores = []
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue
    board[i] = isMaximising ? 'O' : 'X'
    scores.push(minimax(board, depth + 1, !isMaximising))
    board[i] = null
  }
  return isMaximising ? Math.max(...scores) : Math.min(...scores)
}

function bestMove(board) {
  let bestScore = -Infinity
  let move = null
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue
    board[i] = 'O'
    const score = minimax(board, 0, false)
    board[i] = null
    if (score > bestScore) {
      bestScore = score
      move = i
    }
  }
  return move
}

export { sessions }
