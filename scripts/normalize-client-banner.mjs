#!/usr/bin/env node
/**
 * Emit client/client.js from the tsdown cjs output by wrapping it in the
 * harness __ModuleLoader__ closure-factory contract:
 *
 *   window.__ModuleLoader__.load({ id, factory: (require) => {
 *     var module = { exports: {} };
 *     var exports = module.exports;
 *     ...cjs body...
 *     return module.exports;
 *   }
 *   });
 *
 * tsdown emits `client.cjs` for cjs format; the published contract (enforced
 * by preflight.mjs) names the artifact client.js and starts it with the exact
 * loader prefix.
 */
import fs from 'node:fs'

const name = JSON.parse(fs.readFileSync('package.json', 'utf8')).name
const idJson = JSON.stringify(name)
const cjs = 'client/client.cjs'
const out = 'client/client.js'

if (!fs.existsSync(cjs)) {
  console.error(`normalize-client-banner: missing ${cjs}`)
  process.exit(1)
}

let body = fs.readFileSync(cjs, 'utf8')
body = body.replace('sourceMappingURL=client.cjs.map', 'sourceMappingURL=client.js.map')

const wrapped = [
  `window.__ModuleLoader__.load({ id: ${idJson}, factory: (require) => {`,
  '\tvar module = { exports: {} };',
  '\tvar exports = module.exports;',
  body,
  '\treturn module.exports;',
  '}',
  '});',
  '',
].join('\n')

fs.writeFileSync(out, wrapped)
if (fs.existsSync(cjs + '.map')) fs.renameSync(cjs + '.map', out + '.map')
fs.unlinkSync(cjs)
console.log(`normalize-client-banner ok: ${out}`)
