import { styles, render } from '../../services/textmaker.js'
import { UserError } from '../../lib/errors.js'
import { bold } from '../../lib/text.js'

/**
 * One real renderer (SVG + sharp), many styles. Unlike the usual "79 textmaker
 * commands", each style here is a distinct SVG recipe — not an alias.
 */
export default [
  {
    name: 'textmaker',
    aliases: ['tm', 'textimg'],
    category: 'tools',
    description: 'Render text as a styled image (works offline, no API key)',
    usage: '.textmaker neon Dark Eyes',
    examples: ['.textmaker fire HELLO', '.textmaker matrix wake up', '.textmaker gold VIP'],
    cooldown: 6,
    async execute(ctx) {
      const [styleName, ...rest] = ctx.args
      if (!styleName) {
        return ctx.reply(
          `🎨 *Text maker styles*\n\n${styles.map((s) => `• ${s}`).join('\n')}\n\n` +
            `*Usage:* ${ctx.prefix}textmaker <style> <text>\n` +
            `_Example:_ ${ctx.prefix}textmaker neon Dark Eyes`
        )
      }

      const style = styleName.toLowerCase()
      if (!styles.includes(style)) {
        throw new UserError(`Unknown style *${styleName}*.`, { hint: `Styles: ${styles.join(', ')}` })
      }

      const text = rest.join(' ')
      if (!text) throw new UserError(`Give me the text. Example: ${ctx.prefix}textmaker ${style} Hello`)

      const image = await render(text, style)
      return ctx.replyMedia(image, 'image/png', `🎨 ${bold(style)}`)
    }
  }
]
