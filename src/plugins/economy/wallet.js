import { UserError } from '../../lib/errors.js'
import { bold, pick } from '../../lib/text.js'
import { formatDuration } from '../../lib/time.js'
import { toNumber } from '../../lib/jid.js'

const eco = (ctx) => ctx.services.db
const money = (n) => n.toLocaleString()

/** Shared cooldown gate so every earn command behaves the same. */
function gate(ctx, action, label) {
  const left = ctx.services.economy.cooldownLeft(ctx.chat, ctx.sender, action)
  if (left > 0) throw new UserError(`${label} is on cooldown.`, { hint: `Try again in ${formatDuration(left)}.` })
  ctx.services.economy.stamp(ctx.chat, ctx.sender, action)
}

const JOBS = [
  ['driver', 120, 260], ['trader', 150, 320], ['barber', 110, 240], ['developer', 180, 380],
  ['chef', 130, 280], ['security guard', 100, 220], ['tailor', 115, 250], ['mechanic', 140, 300]
]

export default [
  {
    name: 'balance',
    aliases: ['bal', 'wallet', 'coins', 'money'],
    category: 'economy',
    description: 'Your wallet balance',
    usage: '.balance [@user]',
    cooldown: 2,
    async execute(ctx) {
      const target = ctx.mentions[0] ?? ctx.sender
      const row = ctx.services.economy.wallet(ctx.chat, target)
      const level = ctx.services.economy.level(row.xp)
      return ctx.reply(
        `👁️ ${bold('WALLET')} — @${toNumber(target)}\n\n` +
          `💰 *Pocket:* ${money(row.balance)}\n` +
          `🏦 *Bank:* ${money(row.bank)}\n` +
          `📈 *Net worth:* ${money(row.balance + row.bank)}\n\n` +
          `⭐ *Level:* ${level} (${row.xp} XP)\n` +
          (row.job ? `💼 *Job:* ${row.job}` : `💼 *Job:* unemployed — ${ctx.prefix}work list`),
        { mentions: [target] }
      )
    }
  },

  {
    name: 'daily',
    aliases: ['claim'],
    category: 'economy',
    description: 'Claim your daily coins',
    cooldown: 3,
    async execute(ctx) {
      gate(ctx, 'daily', 'Daily reward')
      const amount = 300 + Math.floor(Math.random() * 200)
      const row = ctx.services.economy.addCoins(ctx.chat, ctx.sender, amount)
      ctx.services.economy.addXp(ctx.chat, ctx.sender, 25)
      return ctx.reply(`🎁 You claimed *${money(amount)}* coins.\n\n💰 Pocket: ${money(row.balance)}`)
    }
  },

  {
    name: 'work',
    aliases: ['job'],
    category: 'economy',
    description: 'Work for coins (45 min cooldown)',
    usage: '.work | .work list | .work apply 2',
    cooldown: 2,
    async execute(ctx) {
      const action = ctx.args[0]?.toLowerCase()

      if (action === 'list') {
        const lines = JOBS.map(([name, min, max], i) => `${i + 1}. *${name}* — ${min}–${max} coins/ shift`).join('\n')
        return ctx.reply(`💼 *Available jobs*\n\n${lines}\n\nApply with: ${ctx.prefix}work apply <number>`)
      }

      if (action === 'apply') {
        const index = Number.parseInt(ctx.args[1], 10) - 1
        const job = JOBS[index]
        if (!job) throw new UserError('Pick a job number from .work list')
        ctx.services.economy.setJob(ctx.chat, ctx.sender, job[0])
        return ctx.reply(`💼 You now work as a *${job[0]}*.`)
      }

      gate(ctx, 'work', 'Work')

      const row = ctx.services.economy.wallet(ctx.chat, ctx.sender)
      const job = JOBS.find(([name]) => name === row.job) ?? pick(JOBS)
      const pay = Math.floor(job[1] + Math.random() * (job[2] - job[1]))
      const updated = ctx.services.economy.addCoins(ctx.chat, ctx.sender, pay)
      ctx.services.economy.addXp(ctx.chat, ctx.sender, 15)

      const scenes = [
        `You spent the shift as a ${job[0]} and it paid off.`,
        `A long day as a ${job[0]}, but the money is real.`,
        `Your ${job[0]} shift went smoothly — no drama.`,
        `You worked as a ${job[0]} and someone even tipped you.`
      ]
      return ctx.reply(`💼 ${pick(scenes)}\n\n💵 Earned *${money(pay)}* coins\n💰 Pocket: ${money(updated.balance)}`)
    }
  },

  {
    name: 'fish',
    aliases: ['fishing'],
    category: 'economy',
    description: 'Go fishing (2 min cooldown)',
    cooldown: 2,
    async execute(ctx) {
      gate(ctx, 'fish', 'Fishing')
      const rod = ctx.services.economy.inventory(ctx.chat, ctx.sender).some((i) => i.item_id === 'fishing_rod')
      const roll = Math.random()
      const catches = [
        ['an old boot', 0], ['a tin can', 5], ['a small tilapia', 40], ['a catfish', 90],
        ['a silver carp', 150], ['a golden koi', 450]
      ]
      const [catchName, baseValue] = roll < 0.15 ? catches[0] : roll < 0.3 ? catches[1] : catches[2 + Math.floor(Math.random() * 4)]
      const value = Math.floor(baseValue * (rod ? 1.5 : 1))
      const updated = ctx.services.economy.addCoins(ctx.chat, ctx.sender, value)
      return ctx.reply(
        `🎣 You caught ${catchName}${rod ? ' _(fishing rod bonus ×1.5)_' : ''}.\n\n` +
          `💵 ${value ? `Sold for *${money(value)}* coins` : 'Worth nothing'}\n💰 Pocket: ${money(updated.balance)}`
      )
    }
  },

  {
    name: 'mine',
    aliases: ['mining', 'dig'],
    category: 'economy',
    description: 'Go mining (3 min cooldown)',
    cooldown: 2,
    async execute(ctx) {
      gate(ctx, 'mine', 'Mining')
      const pickaxe = ctx.services.economy.inventory(ctx.chat, ctx.sender).some((i) => i.item_id === 'pickaxe')
      const ores = [
        ['stone', 10], ['coal', 60], ['iron', 120], ['gold', 300], ['diamond', 800]
      ]
      const roll = Math.random()
      const index = roll < 0.35 ? 0 : roll < 0.65 ? 1 : roll < 0.85 ? 2 : roll < 0.97 ? 3 : 4
      const [ore, base] = ores[index]
      const value = Math.floor(base * (pickaxe ? 1.6 : 1))
      const updated = ctx.services.economy.addCoins(ctx.chat, ctx.sender, value)
      return ctx.reply(
        `⛏️ You mined *${ore}*${pickaxe ? ' _(pickaxe bonus ×1.6)_' : ''}.\n\n` +
          `💵 Sold for *${money(value)}* coins\n💰 Pocket: ${money(updated.balance)}`
      )
    }
  },

  {
    name: 'rob',
    aliases: ['steal'],
    category: 'economy',
    description: 'Try to rob someone (risky — 15 min cooldown)',
    usage: '.rob @user',
    cooldown: 3,
    async execute(ctx) {
      const target = ctx.mentions[0] ?? ctx.quoted?.key?.participant
      if (!target) throw new UserError('Tag the person you want to rob.')
      if (toNumber(target) === ctx.senderNumber) throw new UserError('You cannot rob yourself.')

      gate(ctx, 'rob', 'Robbery')
      const victim = ctx.services.economy.wallet(ctx.chat, target)
      const hasShield = ctx.services.economy.inventory(ctx.chat, target).some((i) => i.item_id === 'shield')

      if (victim.balance < 100) throw new UserError('That person has almost nothing. Have some mercy.')
      if (hasShield && Math.random() < 0.7) {
        ctx.services.economy.removeItem(ctx.chat, target, 'shield', 1)
        return ctx.reply(`🛡️ @${toNumber(target)} blocked your attempt — their shield is now used up.`, { mentions: [target] })
      }

      if (Math.random() < 0.45) {
        const loot = Math.floor(victim.balance * (0.1 + Math.random() * 0.2))
        ctx.services.economy.addCoins(ctx.chat, target, -loot)
        const updated = ctx.services.economy.addCoins(ctx.chat, ctx.sender, loot)
        return ctx.reply(
          `🥷 Successful heist!\n\nYou took *${money(loot)}* coins from @${toNumber(target)}.\n💰 Pocket: ${money(updated.balance)}`,
          { mentions: [target] }
        )
      }

      const fine = Math.min(victim.balance, 150 + Math.floor(Math.random() * 250))
      const updated = ctx.services.economy.addCoins(ctx.chat, ctx.sender, -fine)
      return ctx.reply(
        `🚨 Caught! You paid *${money(fine)}* coins in damages.\n💰 Pocket: ${money(updated.balance)}`
      )
    }
  },

  {
    name: 'bank',
    category: 'economy',
    description: 'Deposit or withdraw coins',
    usage: '.bank deposit 500 | .bank withdraw 500',
    cooldown: 2,
    async execute(ctx) {
      const [action, amountRaw] = ctx.args
      const row = ctx.services.economy.wallet(ctx.chat, ctx.sender)

      if (!action) {
        return ctx.reply(
          `🏦 *BANK*\n\n💰 Pocket: ${money(row.balance)}\n🏦 Bank: ${money(row.bank)}\n\n` +
            `${ctx.prefix}bank deposit <amount> · ${ctx.prefix}bank withdraw <amount>`
        )
      }

      const amount = amountRaw === 'all' ? (action === 'deposit' ? row.balance : row.bank) : Number.parseInt(amountRaw, 10)
      if (!Number.isFinite(amount) || amount <= 0) throw new UserError('Give me an amount (or "all").')

      if (action === 'deposit' || action === 'dep') {
        const updated = ctx.services.economy.deposit(ctx.chat, ctx.sender, amount)
        if (!updated) throw new UserError('You do not have that much in your pocket.')
        return ctx.reply(`🏦 Deposited *${money(amount)}*.\n\n💰 Pocket: ${money(updated.balance)}\n🏦 Bank: ${money(updated.bank)}`)
      }

      if (action === 'withdraw' || action === 'with') {
        const updated = ctx.services.economy.withdraw(ctx.chat, ctx.sender, amount)
        if (!updated) throw new UserError('You do not have that much in the bank.')
        return ctx.reply(`🏦 Withdrew *${money(amount)}*.\n\n💰 Pocket: ${money(updated.balance)}\n🏦 Bank: ${money(updated.bank)}`)
      }

      throw new UserError('Use *deposit* or *withdraw*.')
    }
  },

  {
    name: 'pay',
    aliases: ['transfer', 'give'],
    category: 'economy',
    description: 'Send coins to someone',
    usage: '.pay @user 500',
    cooldown: 3,
    async execute(ctx) {
      const target = ctx.mentions[0] ?? ctx.quoted?.key?.participant
      if (!target) throw new UserError('Tag the person you are paying.')
      if (toNumber(target) === ctx.senderNumber) throw new UserError('Paying yourself changes nothing.')

      const targetNumber = toNumber(target)
      const amount = Number.parseInt(
        ctx.args.filter((a) => /^\d+$/.test(a) && a !== targetNumber).at(-1),
        10
      )
      if (!Number.isFinite(amount) || amount <= 0) throw new UserError('How much? Example: .pay @user 500')

      const updated = ctx.services.economy.transfer(ctx.chat, ctx.sender, target, amount)
      if (!updated) throw new UserError('You do not have that much in your pocket.')
      return ctx.reply(`💸 Sent *${money(amount)}* coins to @${toNumber(target)}.\n💰 Your pocket: ${money(updated.balance)}`, {
        mentions: [target]
      })
    }
  },

  {
    name: 'gamble',
    aliases: ['bet'],
    category: 'economy',
    description: 'Bet coins on a coin toss (48% win rate)',
    usage: '.gamble 100',
    cooldown: 5,
    async execute(ctx) {
      const amount = Number.parseInt(ctx.args[0], 10)
      if (!Number.isFinite(amount) || amount <= 0) throw new UserError('How much are you betting?')
      const row = ctx.services.economy.wallet(ctx.chat, ctx.sender)
      if (amount > row.balance) throw new UserError(`You only have ${money(row.balance)} in your pocket.`)

      const lucky = ctx.services.economy.inventory(ctx.chat, ctx.sender).some((i) => i.item_id === 'lucky_charm')
      const winChance = lucky ? 0.53 : 0.48
      const win = Math.random() < winChance

      if (win) {
        const updated = ctx.services.economy.addCoins(ctx.chat, ctx.sender, amount)
        return ctx.reply(`🎲 You won!\n\n+*${money(amount)}* coins\n💰 Pocket: ${money(updated.balance)}${lucky ? '\n_🍀 Lucky charm helped._' : ''}`)
      }
      const updated = ctx.services.economy.addCoins(ctx.chat, ctx.sender, -amount)
      return ctx.reply(`🎲 You lost.\n\n-*${money(amount)}* coins\n💰 Pocket: ${money(updated.balance)}`)
    }
  },

  {
    name: 'shop',
    aliases: ['store'],
    category: 'economy',
    description: 'Items you can buy',
    cooldown: 3,
    async execute(ctx) {
      const lines = Object.entries(ctx.services.economy.SHOP)
        .map(([id, item]) => `• *${item.name}* — ${money(item.price)} coins\n   _${item.description}_\n   \`${ctx.prefix}buy ${id}\``)
        .join('\n\n')
      return ctx.reply(`🛒 *DARK EYES SHOP*\n\n${lines}`)
    }
  },

  {
    name: 'buy',
    category: 'economy',
    description: 'Buy an item from the shop',
    usage: '.buy shield',
    cooldown: 3,
    async execute(ctx) {
      const itemId = ctx.args[0]?.toLowerCase()
      const item = ctx.services.economy.SHOP[itemId]
      if (!item) throw new UserError('Unknown item. See .shop')

      const row = ctx.services.economy.wallet(ctx.chat, ctx.sender)
      if (row.balance < item.price) {
        throw new UserError(`You need ${money(item.price)} coins — you have ${money(row.balance)}.`)
      }

      ctx.services.economy.addCoins(ctx.chat, ctx.sender, -item.price)
      ctx.services.economy.addItem(ctx.chat, ctx.sender, itemId, 1)
      return ctx.reply(`✅ Bought *${item.name}* for ${money(item.price)} coins.\n\n_${item.description}_`)
    }
  },

  {
    name: 'inventory',
    aliases: ['inv', 'items'],
    category: 'economy',
    description: 'Everything you own',
    cooldown: 3,
    async execute(ctx) {
      const items = ctx.services.economy.inventory(ctx.chat, ctx.sender)
      if (!items.length) return ctx.reply(`🎒 Your inventory is empty.\n\nBrowse the shop: ${ctx.prefix}shop`)
      const lines = items
        .map((i) => `• *${ctx.services.economy.SHOP[i.item_id]?.name ?? i.item_id}* ×${i.quantity}`)
        .join('\n')
      return ctx.reply(`🎒 *INVENTORY*\n\n${lines}`)
    }
  },

  {
    name: 'richlist',
    aliases: ['top', 'leaderboard', 'lb'],
    category: 'economy',
    description: 'Richest people in this chat',
    cooldown: 4,
    async execute(ctx) {
      const rows = ctx.services.economy.leaderboard(ctx.chat, 10)
      if (!rows.length) return ctx.reply('Nobody has any coins yet. Start with .daily')
      const medals = ['🥇', '🥈', '🥉']
      const lines = rows
        .map((r, i) => `${medals[i] ?? `${i + 1}.`} @${toNumber(r.user_jid)} — *${money(r.total)}*`)
        .join('\n')
      return ctx.reply(`🏆 *RICHLIST*\n\n${lines}`, { mentions: rows.map((r) => r.user_jid) })
    }
  }
]
