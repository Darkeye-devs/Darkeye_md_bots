import test from 'node:test'
import assert from 'node:assert/strict'
import { loadRegistry, closeDb } from './harness.js'

const { registry, registryStats, resolve, visibleCommands } = await loadRegistry()

test('every plugin file loads without error', () => {
  assert.equal(registry.failed.length, 0, JSON.stringify(registry.failed, null, 2))
})

test('every command has the required metadata', () => {
  for (const [name, plugin] of registry.commands) {
    assert.ok(plugin.description?.length > 5, `${name} needs a description`)
    assert.ok(plugin.category, `${name} needs a category`)
    assert.equal(typeof plugin.execute, 'function', `${name}.execute must be a function`)
    assert.match(name, /^[a-z0-9][a-z0-9-]*$/, `${name} must be lowercase`)
  }
})

test('no alias shadows a real command', () => {
  for (const alias of registry.aliases.keys()) {
    assert.ok(!registry.commands.has(alias), `alias ${alias} is also a command`)
  }
})

test('every alias resolves to a live plugin', () => {
  for (const [alias, canonical] of registry.aliases) {
    assert.ok(registry.commands.has(canonical), `${alias} → missing ${canonical}`)
    assert.ok(resolve(alias), `${alias} does not resolve`)
  }
})

test('we ship a serious number of commands', () => {
  const stats = registryStats()
  assert.ok(stats.commands >= 200, `expected 200+ commands, got ${stats.commands}`)
  assert.ok(stats.categories >= 8, `expected 8+ categories, got ${stats.categories}`)
})

test('menu-visible commands exclude hidden ones', () => {
  const hidden = [...registry.commands.values()].filter((p) => p.hidden)
  assert.ok(hidden.length > 0)
  assert.equal(visibleCommands().length, registry.commands.size - hidden.length)
})

test('no duplicate plugin names across files', () => {
  const seen = new Map()
  for (const [name, plugin] of registry.commands) {
    if (seen.has(name)) assert.fail(`${name} defined twice: ${seen.get(name)} and ${plugin.file}`)
    seen.set(name, plugin.file)
  }
})

test.after(() => closeDb())
