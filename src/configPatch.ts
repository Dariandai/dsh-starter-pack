/**
 * Recommended-config application into the profile's `cordis.patch.yml`.
 *
 * The profile patch file is a top-level YAML array of Cordis PatchOptions:
 * `{ id, config }` entries override an entry's config by loader id, and
 * `{ insert: [...] }` entries add new rows. This module only ever targets the
 * curated plugin entry ids the pack owns, merging (never clobbering) their
 * `config` map. If the file cannot be parsed safely (e.g. `!!js` expressions
 * the core schema rejects), it backs off gracefully instead of corrupting the
 * user's config.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { join } from 'node:path'
import type { CuratedPlugin } from './registry.ts'
import { profileDir } from './installer.ts'

/** Top-level array item in a cordis patch file. */
interface PatchItem {
  id?: unknown
  insert?: unknown
  config?: Record<string, unknown>
}

export function profilePatchFile(profile: string): string {
  return join(profileDir(profile), 'cordis.patch.yml')
}

export type ConfigApplyResult =
  | { kind: 'applied'; entryId: string }
  | { kind: 'no-config'; entryId: string }
  | { kind: 'skipped-parse-error'; entryId: string; error: string }

/**
 * Apply a curated plugin's recommended config into the profile patch.
 * No-op when the plugin ships no `recommendedConfig`.
 */
export function applyRecommendedConfig(profile: string, plugin: CuratedPlugin): ConfigApplyResult {
  const config = plugin.recommendedConfig
  if (config === undefined || Object.keys(config).length === 0) {
    return { kind: 'no-config', entryId: plugin.id }
  }
  const file = profilePatchFile(profile)
  try {
    let items: PatchItem[]
    if (!existsSync(file)) {
      items = []
    } else {
      const parsed = parseYaml(readFileSync(file, 'utf8'), { schema: 'core' })
      if (parsed === null || parsed === undefined) {
        items = []
      } else if (Array.isArray(parsed)) {
        items = parsed as PatchItem[]
      } else {
        return { kind: 'skipped-parse-error', entryId: plugin.id, error: 'patch file root is not a YAML array' }
      }
    }
    const target = items.find((item) => typeof item?.id === 'string' && item.id === plugin.id)
    if (target === undefined) {
      items.push({ id: plugin.id, config })
    } else {
      target.config = { ...(target.config ?? {}), ...config }
    }
    writeFileSync(file, stringifyYaml(items, { schema: 'core', indent: 2, lineWidth: 0 }))
    return { kind: 'applied', entryId: plugin.id }
  } catch (error) {
    return { kind: 'skipped-parse-error', entryId: plugin.id, error: error instanceof Error ? error.message : String(error) }
  }
}
