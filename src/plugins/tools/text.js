import crypto from 'node:crypto'
import { UserError } from '../../lib/errors.js'
import { bold } from '../../lib/text.js'

const needText = (ctx, usage) => {
  const text = ctx.argsText
  if (!text) throw new UserError(`Give me some text. Usage: ${usage}`)
  return text
}

export default [
  {
    name: 'count',
    aliases: ['wordcount', 'wc'],
    category: 'tools',
    description: 'Count characters, words, lines and reading time',
    cooldown: 2,
    async execute(ctx) {
      const text = ctx.quotedText || needText(ctx, '.count <text>')
      const words = text.trim().split(/\s+/).filter(Boolean)
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim()).length
      const readMinutes = Math.max(1, Math.round(words.length / 220))
      return ctx.reply(
        `📊 ${bold('TEXT STATS')}\n\n` +
          `*Characters:* ${text.length}\n` +
          `*Without spaces:* ${text.replace(/\s/g, '').length}\n` +
          `*Words:* ${words.length}\n` +
          `*Sentences:* ${sentences}\n` +
          `*Lines:* ${text.split('\n').length}\n` +
          `*Reading time:* ~${readMinutes} min`
      )
    }
  },

  {
    name: 'upper',
    aliases: ['uppercase'],
    category: 'tools',
    description: 'SHOUT THE TEXT',
    cooldown: 2,
    async execute(ctx) {
      return ctx.reply((ctx.quotedText || needText(ctx, '.upper <text>')).toUpperCase())
    }
  },

  {
    name: 'lower',
    aliases: ['lowercase'],
    category: 'tools',
    description: 'quiet the text',
    cooldown: 2,
    async execute(ctx) {
      return ctx.reply((ctx.quotedText || needText(ctx, '.lower <text>')).toLowerCase())
    }
  },

  {
    name: 'reverse',
    category: 'tools',
    description: 'Reverse text character by character',
    cooldown: 2,
    async execute(ctx) {
      const text = ctx.quotedText || needText(ctx, '.reverse <text>')
      return ctx.reply([...text].reverse().join(''))
    }
  },

  {
    name: 'title',
    aliases: ['titlecase'],
    category: 'tools',
    description: 'Capitalise Each Word',
    cooldown: 2,
    async execute(ctx) {
      const text = ctx.quotedText || needText(ctx, '.title <text>')
      return ctx.reply(text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()))
    }
  },

  {
    name: 'spoiler',
    category: 'tools',
    description: 'Wrap text in a WhatsApp spoiler',
    cooldown: 2,
    async execute(ctx) {
      const text = ctx.quotedText || needText(ctx, '.spoiler <text>')
      return ctx.reply(`||${text}||`)
    }
  },

  {
    name: 'readmore',
    category: 'tools',
    description: 'Hide everything after a "read more" break',
    usage: '.readmore visible text | hidden text',
    cooldown: 2,
    async execute(ctx) {
      const text = ctx.argsText
      if (!text.includes('|')) throw new UserError('Separate the two parts with a pipe: visible | hidden')
      const [visible, ...rest] = text.split('|')
      return ctx.reply(`${visible.trim()}\n\n${'‎'.repeat(4000)}${rest.join('|').trim()}`)
    }
  },

  {
    name: 'rot13',
    category: 'tools',
    description: 'ROT13 cipher',
    cooldown: 2,
    async execute(ctx) {
      const text = ctx.quotedText || needText(ctx, '.rot13 <text>')
      return ctx.reply(text.replace(/[a-z]/gi, (c) => {
        const base = c <= 'Z' ? 65 : 97
        return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base)
      }))
    }
  },

  {
    name: 'caesar',
    category: 'tools',
    description: 'Caesar cipher with a custom shift',
    usage: '.caesar 3 hello',
    cooldown: 2,
    async execute(ctx) {
      const shift = Number.parseInt(ctx.args[0], 10)
      if (!Number.isFinite(shift)) throw new UserError('Give me a shift amount. Example: .caesar 3 hello')
      const text = ctx.args.slice(1).join(' ') || ctx.quotedText
      if (!text) throw new UserError('Give me text to encode.')
      const n = ((shift % 26) + 26) % 26
      return ctx.reply(text.replace(/[a-z]/gi, (c) => {
        const base = c <= 'Z' ? 65 : 97
        return String.fromCharCode(((c.charCodeAt(0) - base + n) % 26) + base)
      }))
    }
  },

  {
    name: 'atbash',
    category: 'tools',
    description: 'Atbash cipher (A↔Z, B↔Y …)',
    cooldown: 2,
    async execute(ctx) {
      const text = ctx.quotedText || needText(ctx, '.atbash <text>')
      return ctx.reply(text.replace(/[a-z]/gi, (c) => {
        const base = c <= 'Z' ? 65 : 97
        return String.fromCharCode(25 - (c.charCodeAt(0) - base) + base)
      }))
    }
  },

  {
    name: 'hash',
    aliases: ['md5', 'sha256'],
    category: 'tools',
    description: 'Hash text (md5, sha1, sha256, sha512)',
    usage: '.hash sha256 hello',
    cooldown: 2,
    async execute(ctx) {
      const algorithms = ['md5', 'sha1', 'sha256', 'sha512']
      let algorithm = 'sha256'
      let text = ctx.argsText

      if (algorithms.includes(ctx.command)) {
        algorithm = ctx.command
      } else if (algorithms.includes(ctx.args[0])) {
        algorithm = ctx.args[0]
        text = ctx.args.slice(1).join(' ')
      }

      if (!text) throw new UserError(`Give me text to hash. Usage: .hash ${algorithm} <text>`)
      const digest = crypto.createHash(algorithm).update(text).digest('hex')
      return ctx.reply(`🔐 *${algorithm.toUpperCase()}*\n\n\`\`\`${digest}\`\`\``)
    }
  },

  {
    name: 'uuid',
    aliases: ['guid'],
    category: 'tools',
    description: 'Generate a UUID v4',
    cooldown: 1,
    async execute(ctx) {
      return ctx.reply(`\`\`\`${crypto.randomUUID()}\`\`\``)
    }
  },

  {
    name: 'password',
    aliases: ['passgen', 'genpass'],
    category: 'tools',
    description: 'Generate a strong password (real entropy, not a wordlist)',
    usage: '.password [length]',
    cooldown: 3,
    async execute(ctx) {
      const length = Math.min(64, Math.max(8, Number.parseInt(ctx.args[0] ?? '20', 10) || 20))
      const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_=+?'
      const bytes = crypto.randomBytes(length)
      let password = ''
      for (let i = 0; i < length; i++) password += chars[bytes[i] % chars.length]

      const entropy = Math.round(length * Math.log2(chars.length))
      return ctx.reply(
        `🔑 \`${password}\`\n\n*Length:* ${length}\n*Entropy:* ~${entropy} bits ${
          entropy >= 100 ? '✅ excellent' : entropy >= 70 ? '🟡 good' : '🔴 weak'
        }\n_Generated locally with crypto.randomBytes — never sent anywhere._`
      )
    }
  },

  {
    name: 'passwordcheck',
    aliases: ['passstrength'],
    category: 'tools',
    description: 'Estimate how strong a password is',
    usage: '.passwordcheck <password>',
    cooldown: 3,
    privateOnly: false,
    async execute(ctx) {
      const password = ctx.argsText
      if (!password) throw new UserError('Give me a password to check.')
      const pool = (/[a-z]/.test(password) ? 26 : 0) + (/[A-Z]/.test(password) ? 26 : 0) + (/\d/.test(password) ? 10 : 0) + (/[^a-zA-Z0-9]/.test(password) ? 32 : 0)
      const entropy = Math.round(password.length * Math.log2(Math.max(pool, 2)))
      const verdict = entropy >= 100 ? '✅ Excellent' : entropy >= 70 ? '🟡 Good' : entropy >= 45 ? '🟠 Weak' : '🔴 Very weak'
      return ctx.reply(
        `${verdict}\n\n*Length:* ${password.length}\n*Charset size:* ${pool}\n*Entropy:* ~${entropy} bits\n\n` +
          `_Rule of thumb: 80+ bits is a strong password._`
      )
    }
  },

  {
    name: 'lorem',
    aliases: ['loremipsum'],
    category: 'tools',
    description: 'Generate placeholder text',
    usage: '.lorem 2',
    cooldown: 2,
    async execute(ctx) {
      const paragraphs = Math.min(5, Math.max(1, Number.parseInt(ctx.args[0] ?? '1', 10) || 1))
      const sentences = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
        'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.',
        'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.'
      ]
      const out = Array.from({ length: paragraphs }, () => sentences.sort(() => Math.random() - 0.5).join(' '))
      return ctx.reply(out.join('\n\n'))
    }
  },

  {
    name: 'calc',
    aliases: ['calculate', 'math'],
    category: 'tools',
    description: 'Do maths safely (no eval, real expression parser)',
    usage: '.calc (12 * 8) + 4 ^ 2',
    cooldown: 2,
    async execute(ctx) {
      const expression = ctx.argsText
      if (!expression) throw new UserError('Give me an expression. Example: .calc (12*8)+4')

      const result = evaluate(expression)
      return ctx.reply(`🧮 \`${expression}\`\n\n= *${result}*`)
    }
  },

  {
    name: 'bmi',
    category: 'tools',
    description: 'Body mass index',
    usage: '.bmi 70 1.75  (kg and metres)',
    cooldown: 3,
    async execute(ctx) {
      const weight = Number.parseFloat(ctx.args[0])
      const height = Number.parseFloat(ctx.args[1])
      if (!Number.isFinite(weight) || !Number.isFinite(height) || height <= 0) {
        throw new UserError('Usage: .bmi <weight in kg> <height in metres>')
      }
      const bmi = weight / (height * height)
      const category =
        bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal weight' : bmi < 30 ? 'Overweight' : 'Obese'
      return ctx.reply(`⚖️ *BMI:* ${bmi.toFixed(1)}\n*Category:* ${category}`)
    }
  }
]

// ── safe arithmetic parser ───────────────────
/**
 * Tiny shunting-yard evaluator. Supports + - * / % ^ ( ) and unary minus.
 * Deliberately not eval() — an owner .eval already exists, this one is safe for everyone.
 */
function evaluate(expression) {
  const tokens = String(expression)
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/,/g, '')
    .match(/(\d+\.?\d*|\.\d+|[+\-*/%^()])/g)

  if (!tokens) throw new UserError('That expression has no numbers in it.')

  const output = []
  const operators = []
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 }
  const rightAssociative = { '^': true }

  let prev = null
  for (const token of tokens) {
    if (/^\d|^\./.test(token)) {
      output.push(Number.parseFloat(token))
    } else if (token === '(') {
      operators.push(token)
    } else if (token === ')') {
      while (operators.length && operators.at(-1) !== '(') output.push(operators.pop())
      if (!operators.length) throw new UserError('Unbalanced brackets.')
      operators.pop()
    } else {
      // unary minus: "-5" or "(-5" or "* -5"
      if (token === '-' && (prev === null || prev === '(' || precedence[prev])) {
        output.push(-1)
        operators.push('*')
        prev = token
        continue
      }
      while (
        operators.length &&
        operators.at(-1) !== '(' &&
        (precedence[operators.at(-1)] > precedence[token] ||
          (precedence[operators.at(-1)] === precedence[token] && !rightAssociative[token]))
      ) {
        output.push(operators.pop())
      }
      operators.push(token)
    }
    prev = token
  }

  while (operators.length) {
    const op = operators.pop()
    if (op === '(') throw new UserError('Unbalanced brackets.')
    output.push(op)
  }

  const stack = []
  for (const token of output) {
    if (typeof token === 'number') {
      stack.push(token)
      continue
    }
    const b = stack.pop()
    const a = stack.pop()
    if (a === undefined || b === undefined) throw new UserError('That expression is malformed.')
    switch (token) {
      case '+': stack.push(a + b); break
      case '-': stack.push(a - b); break
      case '*': stack.push(a * b); break
      case '/':
        if (b === 0) throw new UserError('Division by zero is not allowed.')
        stack.push(a / b)
        break
      case '%': stack.push(a % b); break
      case '^': stack.push(a ** b); break
      default: throw new UserError(`Unknown operator ${token}.`)
    }
  }

  if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new UserError('Could not evaluate that expression.')
  return Number(stack[0].toFixed(10)).toLocaleString(undefined, { maximumFractionDigits: 10 })
}
