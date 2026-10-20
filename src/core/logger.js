import pino from 'pino'
import { config } from '../config/index.js'

let transport

// Pretty logs in development, plain JSON in production / containers.
if (!config.isProduction) {
  try {
    await import('pino-pretty')
    transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname', singleLine: false }
    }
  } catch {
    transport = undefined
  }
}

export const logger = pino({
  level: config.logLevel,
  base: { service: 'dark-eyes' },
  ...(transport ? { transport } : {})
})

/** Named logger: log('router').info('...') */
export const log = (scope) => logger.child({ scope })

/** Baileys is extremely chatty — give it its own silent logger by default. */
export const baileysLogger = pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' })

export default logger
