#!/usr/bin/env node
/**
 * Pre-pack guard: every place that must carry the npm package name actually
 * does — cordis patch entry and the client __ModuleLoader__ id are plain
 * strings no compiler checks.
 */
import fs from 'node:fs'

const name = JSON.parse(fs.readFileSync('package.json', 'utf8')).name

const failures = []

const patch = fs.readFileSync('cordis.patch.yml', 'utf8')
if (!patch.includes(`name: '${name}'`)) {
  failures.push(`cordis.patch.yml must insert by package name '${name}'`)
}

const client = fs.readFileSync('client/client.js', 'utf8')
if (!client.startsWith(`window.__ModuleLoader__.load({ id: ${JSON.stringify(name)}`)) {
  failures.push(`client/client.js must register __ModuleLoader__ id ${JSON.stringify(name)}`)
}

if (failures.length > 0) {
  console.error('preflight failed:\n- ' + failures.join('\n- '))
  process.exit(1)
}
console.log(`preflight ok: ${name}`)
