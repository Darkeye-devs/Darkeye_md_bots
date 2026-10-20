#!/usr/bin/env node
/** Parse every source file so a typo can never reach production. */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const targets = ['src', 'tests', 'scripts']

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.cjs')) out.push(full)
  }
  return out
}

let failures = 0
let checked = 0

for (const target of targets) {
  const dir = path.join(root, target)
  if (!fs.existsSync(dir)) continue
  for (const file of walk(dir)) {
    checked++
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
    } catch (error) {
      failures++
      console.error(`\n✗ ${path.relative(root, file)}`)
      console.error(String(error.stderr ?? error.message).trim().split('\n').slice(0, 4).join('\n'))
    }
  }
}

console.log(failures ? `\n${failures}/${checked} file(s) failed` : `✓ ${checked} files parsed cleanly`)
process.exit(failures ? 1 : 0)
