import * as database from './database.js'
import * as aiService from './ai.js'
import sticker from './sticker.js'
import downloader from './downloader.js'
import textmaker from './textmaker.js'
import * as scheduler from './scheduler.js'
import * as economy from './economy.js'
import * as content from './content.js'
import { capabilities } from '../core/registry.js'

/**
 * The `services` bucket every plugin receives as ctx.services.
 * Everything is lazily imported by the plugin layer, so a dormant
 * service (no API key) simply reports itself unavailable.
 */
export const services = {
  db: database,
  ai: aiService,
  sticker,
  downloader,
  textmaker,
  scheduler,
  economy,
  content,
  capabilities
}

/** Read-only view for handlers that only need the DB. */
export const db = database
export const ai = aiService

export default services
