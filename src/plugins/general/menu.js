import { renderMenu, renderCommandHelp } from '../../lib/menu.js'
import { resolve, categoryList, registry, registryStats, availability } from '../../core/registry.js'
import { suggestCommands } from '../../core/router.js'
import { config } from '../../config/index.js'
import { bold } from '../../lib/text.js'
import { UserError } from '../../lib/errors.js'

export default [
  {
    name: 'menu',
    aliases: ['help', 'commands', 'allmenu'],
    category: 'general',
    description: 'Show the command menu, or one category in detail',
    usage: '.menu [category]',
    examples: ['.menu', '.menu moderation', '.menu general'],
    cooldown: 2,
    async execute(ctx) {
      const page = ctx.args[0] ?? null
      if (page && !['all'].includes(page.toLowerCase())) {
        const categories = categoryList().map(([n]) => n)
        if (!categories.includes(page.toLowerCase())) {
          throw new UserError(`No category called *${page}*.`, {
            hint: `Available: ${categories.join(', ')}`
          })
        }
      }
      return ctx.reply(renderMenu({ page: page === 'all' ? null : page }))
    }
  },

  {
    name: 'cmd',
    hidden: true,
    category: 'general',
    description: 'Look up a single command',
    usage: '.cmd <command>',
    async execute(ctx) {
      const [name] = ctx.args
      if (!name) throw new UserError('Which command? Example: .cmd sticker')
      const plugin = resolve(name.replace(/^[.!/#]/, ''))
      if (!plugin) {
        const guesses = suggestCommands(name)
        throw new UserError(`I do not have a command called *${name}*.`, {
          hint: guesses.length ? `Did you mean: ${guesses.map((g) => `${config.prefix}${g}`).join(', ')}?` : undefined
        })
      }
      return ctx.reply(renderCommandHelp(plugin))
    }
  },

  {
    name: 'list',
    category: 'general',
    description: 'Flat list of every command with availability',
    cooldown: 3,
    async execute(ctx) {
      const all = [...registry.commands.values()].filter((p) => !p.hidden)
      const lines = all
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => `${availability(p).available ? '✅' : '⚠️'} ${config.prefix}${p.name}`)
      const stats = registryStats()
      return ctx.reply(
        `${bold('EVERY COMMAND')} — ${stats.commands} live, ${stats.aliases} aliases\n\n${lines.join('\n')}\n\n_⚠️ needs a key or binary_`
      )
    }
  }
]
