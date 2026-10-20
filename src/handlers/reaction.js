import { log } from '../core/logger.js'
import { db } from '../services/index.js'

const logger = log('reaction')

/**
 * Reaction tracking. Plugins can register handlers via the event bus;
 * by default we just record the most recent reaction on a message so
 * features like ".getreaction" have something real to show.
 */
export async function handleReaction(sock, payload) {
  const { key, reaction } = payload
  if (!key?.id) return
  try {
    if (reaction?.text) {
      db.settings.set(`reaction:${key.id}`, reaction.text)
    }
  } catch (error) {
    logger.debug('reaction handling failed: %s', error.message)
  }
}
