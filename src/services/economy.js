import { getDb } from './database.js'
import { normalizeJid } from '../lib/jid.js'

/**
 * Wallet logic lives here so plugins stay thin and the maths stays consistent.
 * Every balance is per chat, so a group economy cannot be farmed across chats.
 */

const now = () => Date.now()

export const COOLDOWNS = {
  daily: 20 * 60 * 60 * 1000,   // 20h so it cannot drift
  work: 45 * 60 * 1000,
  fish: 2 * 60 * 1000,
  mine: 3 * 60 * 1000,
  rob: 15 * 60 * 1000
}

export function wallet(chatJid, userJid) {
  const chat = normalizeJid(chatJid)
  const user = normalizeJid(userJid)
  getDb()
    .prepare('INSERT OR IGNORE INTO economy (chat_jid, user_jid) VALUES (?, ?)')
    .run(chat, user)
  return getDb().prepare('SELECT * FROM economy WHERE chat_jid = ? AND user_jid = ?').get(chat, user)
}

function update(chatJid, userJid, fields) {
  const chat = normalizeJid(chatJid)
  const user = normalizeJid(userJid)
  wallet(chat, user)
  const keys = Object.keys(fields)
  getDb()
    .prepare(`UPDATE economy SET ${keys.map((k) => `${k} = @${k}`).join(', ')} WHERE chat_jid = @chat AND user_jid = @user`)
    .run({ ...fields, chat, user })
  return wallet(chat, user)
}

export function addCoins(chatJid, userJid, amount) {
  const row = wallet(chatJid, userJid)
  const balance = Math.max(0, row.balance + amount)
  return update(chatJid, userJid, { balance })
}

export function addXp(chatJid, userJid, amount) {
  const row = wallet(chatJid, userJid)
  return update(chatJid, userJid, { xp: Math.max(0, row.xp + amount) })
}

export function level(xp) {
  return Math.floor(Math.sqrt(xp / 50)) + 1
}

export function xpForLevel(lvl) {
  return (lvl - 1) ** 2 * 50
}

/** Is this action still on cooldown? Returns remaining ms (0 = ready). */
export function cooldownLeft(chatJid, userJid, action) {
  const row = wallet(chatJid, userJid)
  const last = row[`last_${action}`] ?? 0
  const wait = COOLDOWNS[action] ?? 0
  return Math.max(0, last + wait - now())
}

export function stamp(chatJid, userJid, action) {
  return update(chatJid, userJid, { [`last_${action}`]: now() })
}

/** Move coins between the two pockets safely. */
export function deposit(chatJid, userJid, amount) {
  const row = wallet(chatJid, userJid)
  if (amount <= 0 || amount > row.balance) return null
  return update(chatJid, userJid, { balance: row.balance - amount, bank: row.bank + amount })
}

export function withdraw(chatJid, userJid, amount) {
  const row = wallet(chatJid, userJid)
  if (amount <= 0 || amount > row.bank) return null
  return update(chatJid, userJid, { balance: row.balance + amount, bank: row.bank - amount })
}

export function transfer(fromChat, fromUser, toUser, amount) {
  const sender = wallet(fromChat, fromUser)
  if (amount <= 0 || amount > sender.balance) return null
  update(fromChat, fromUser, { balance: sender.balance - amount })
  addCoins(fromChat, toUser, amount)
  return wallet(fromChat, fromUser)
}

export function setJob(chatJid, userJid, job) {
  return update(chatJid, userJid, { job })
}

export function leaderboard(chatJid, limit = 10) {
  return getDb()
    .prepare('SELECT user_jid, balance + bank AS total, xp FROM economy WHERE chat_jid = ? ORDER BY total DESC LIMIT ?')
    .all(normalizeJid(chatJid), limit)
}

// ── inventory ────────────────────────────────
export function addItem(chatJid, userJid, itemId, quantity = 1) {
  const chat = normalizeJid(chatJid)
  const user = normalizeJid(userJid)
  getDb()
    .prepare(
      `INSERT INTO inventory (chat_jid, user_jid, item_id, quantity) VALUES (?, ?, ?, ?)
       ON CONFLICT(chat_jid, user_jid, item_id) DO UPDATE SET quantity = quantity + excluded.quantity`
    )
    .run(chat, user, itemId, quantity)
}

export function removeItem(chatJid, userJid, itemId, quantity = 1) {
  const chat = normalizeJid(chatJid)
  const user = normalizeJid(userJid)
  const row = getDb()
    .prepare('SELECT quantity FROM inventory WHERE chat_jid = ? AND user_jid = ? AND item_id = ?')
    .get(chat, user, itemId)
  if (!row || row.quantity < quantity) return false
  if (row.quantity === quantity) {
    getDb().prepare('DELETE FROM inventory WHERE chat_jid = ? AND user_jid = ? AND item_id = ?').run(chat, user, itemId)
  } else {
    getDb()
      .prepare('UPDATE inventory SET quantity = quantity - ? WHERE chat_jid = ? AND user_jid = ? AND item_id = ?')
      .run(quantity, chat, user, itemId)
  }
  return true
}

export function inventory(chatJid, userJid) {
  return getDb()
    .prepare('SELECT item_id, quantity FROM inventory WHERE chat_jid = ? AND user_jid = ? ORDER BY item_id')
    .all(normalizeJid(chatJid), normalizeJid(userJid))
}

/** The shop catalogue — prices are in coins, effects are enforced by plugins. */
export const SHOP = {
  fishing_rod: { name: 'Fishing rod', price: 500, description: 'Better fish payouts' },
  pickaxe: { name: 'Pickaxe', price: 800, description: 'Better mining payouts' },
  shield: { name: 'Shield', price: 400, description: 'Blocks one robbery attempt' },
  lucky_charm: { name: 'Lucky charm', price: 1200, description: 'Improves gamble odds slightly' },
  coffee: { name: 'Coffee', price: 150, description: 'Resets your work cooldown once' }
}

export default {
  wallet, addCoins, addXp, level, xpForLevel, cooldownLeft, stamp,
  deposit, withdraw, transfer, setJob, leaderboard, addItem, removeItem, inventory, SHOP, COOLDOWNS
}
