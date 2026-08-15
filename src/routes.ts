/**
 * HTTP routes bridging the Starter Pack settings UI and the `/setup` command
 * to the host: the curated registry with live installed status, and the batch
 * install executor.
 *
 * Security: the install route executes a shell command, so it accepts only
 * same-origin POSTs and only curated entry ids from this package's registry.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { PACK, flatPlugins, type CuratedPlugin } from './registry.ts'
import { installPlugin, readInstalled, isPluginInstalled, readInstalledVersion } from './installer.ts'
import { applyRecommendedConfig } from './configPatch.ts'
import type { StarterHost } from './host.ts'

export interface InstallProgress {
  active: boolean
  current: string
  done: number
  total: number
  lastLine: string
  startedAt: number
}

export interface BatchItemResult {
  id: string
  target: string
  name: string
  status: 'installed' | 'skipped' | 'failed' | 'config-applied'
  note?: string
}

const progress: InstallProgress = { active: false, current: '', done: 0, total: 0, lastLine: '', startedAt: 0 }

const AWESOME_PLUGINS_URL = 'https://awesome-dsh-plugin.com/plugins.json'
const STAR_CACHE_TTL = 6 * 60 * 60 * 1000
const starCache = new Map<string, { plugins: AwesomeEntry[]; expires: number }>()

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin
  const host = request.headers.host
  if (origin === undefined || host === undefined) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 4096) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

/** Resolve curated plugin ids from a request body (strict allowlist). */
function resolveIds(ids: unknown, groups: unknown): CuratedPlugin[] {
  const selected = new Set<string>()
  if (Array.isArray(ids)) for (const id of ids) if (typeof id === 'string') selected.add(id)
  if (Array.isArray(groups)) {
    for (const groupId of groups) {
      if (typeof groupId !== 'string') continue
      const group = PACK.find((g) => g.id === groupId)
      if (group !== undefined) for (const p of group.plugins) selected.add(p.id)
    }
  }
  const all = flatPlugins()
  return all.filter((p) => selected.has(p.id))
}

/**
 * Install a batch of curated plugins, applying recommended config on success.
 * @returns per-plugin results, in request order.
 */
async function runBatch(host: StarterHost, profile: string, plugins: CuratedPlugin[]): Promise<BatchItemResult[]> {
  const installed = readInstalled(profile)
  const results: BatchItemResult[] = []
  progress.active = true
  progress.total = plugins.length
  progress.done = 0
  progress.startedAt = Date.now()
  for (const plugin of plugins) {
    progress.current = plugin.name
    progress.lastLine = ''
    if (isPluginInstalled(profile, installed, plugin)) {
      results.push({ id: plugin.id, target: plugin.target, name: plugin.name, status: 'skipped', note: 'already installed' })
      progress.done += 1
      continue
    }
    const result = await installPlugin(profile, plugin)
    const ok = result.exitCode === 0 && !result.timedOut
    if (ok) {
      // Refresh the installed map so later plugins see this one.
      installed[plugin.target] = installed[plugin.target] ?? plugin.target
      // Apply recommended config for freshly installed plugins only.
      const configResult = applyRecommendedConfig(profile, plugin)
      results.push({
        id: plugin.id,
        target: plugin.target,
        name: plugin.name,
        status: 'installed',
        note: configResult.kind === 'applied' ? 'config applied' : undefined,
      })
    } else {
      results.push({
        id: plugin.id,
        target: plugin.target,
        name: plugin.name,
        status: 'failed',
        note: (result.stderr || result.stdout).slice(-200),
      })
    }
    progress.done += 1
    host.logger?.info?.(`[dsh-starter-pack] ${plugin.name}: ${ok ? 'ok' : 'failed'}`)
  }
  progress.active = false
  return results
}

/** Live-enable a freshly installed plugin through the loader, best-effort. */
export async function tryEnableEntry(host: StarterHost, name: string): Promise<boolean> {
  for (const entry of host.loader.entries()) {
    if (entry.options.name !== name) continue
    try {
      await entry.update({ disabled: null }, false, true)
      return true
    } catch {
      return false
    }
  }
  return false
}

interface AwesomeEntry {
  url?: string
  stars?: number
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase()
}

/** Live stars for every curated plugin, keyed by plugin id; never throws.
 * Pulls the star snapshot from the awesome-dsh-plugin registry (Cloudflare-hosted,
 * reachable without a GitHub proxy), falling back to the static value for plugins
 * missing from that list or on any network failure. */
async function collectStars(): Promise<Record<string, number>> {
  const cached = starCache.get('awesome')
  let entries: AwesomeEntry[] | undefined
  if (cached !== undefined && cached.expires > Date.now()) {
    entries = cached.plugins
  } else {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch(AWESOME_PLUGINS_URL, { signal: controller.signal })
      if (response.ok) {
        const data = (await response.json()) as { plugins?: AwesomeEntry[] }
        entries = data.plugins ?? []
        starCache.set('awesome', { plugins: entries, expires: Date.now() + STAR_CACHE_TTL })
      }
    } catch {
      entries = undefined
    } finally {
      clearTimeout(timer)
    }
  }
  const byUrl = new Map<string, number>()
  if (entries !== undefined) {
    for (const entry of entries) {
      if (typeof entry.url === 'string' && typeof entry.stars === 'number') byUrl.set(normalizeUrl(entry.url), entry.stars)
    }
  }
  const stars: Record<string, number> = {}
  for (const plugin of flatPlugins()) {
    const live = byUrl.get(normalizeUrl(plugin.url))
    stars[plugin.id] = live ?? plugin.stars
  }
  return stars
}

/** Register the Starter Pack HTTP routes. */
export function mountRoutes(host: StarterHost, profile: string): () => void {
  const disposers = [
    host.webServer.register({
      kind: 'exact',
      path: '/dsh-starter-pack/registry',
      handler: (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        const installed = readInstalled(profile)
        const groups = PACK.map((group) => ({
          id: group.id,
          title: group.title,
          blurb: group.blurb,
          plugins: group.plugins.map((p) => ({
            id: p.id,
            name: p.name,
            target: p.target,
            url: p.url,
            category: p.category,
            stars: p.stars,
            why: p.why,
            installed: isPluginInstalled(profile, installed, p),
            version: readInstalledVersion(profile, p.target),
          })),
        }))
        sendJson(response, 200, { groups, profile })
      },
    }),

    host.webServer.register({
      kind: 'exact',
      path: '/dsh-starter-pack/stars',
      handler: async (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        sendJson(response, 200, { stars: await collectStars() })
      },
    }),

    host.webServer.register({
      kind: 'exact',
      path: '/dsh-starter-pack/status',
      handler: (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        sendJson(response, 200, { ...progress, seconds: progress.active ? Math.round((Date.now() - progress.startedAt) / 1000) : 0 })
      },
    }),

    host.webServer.register({
      kind: 'exact',
      path: '/dsh-starter-pack/install',
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' })
          response.end()
          return
        }
        if (!sameOrigin(request)) {
          sendJson(response, 403, { error: 'untrusted origin' })
          return
        }
        if (progress.active) {
          sendJson(response, 409, { error: 'another install is already running' })
          return
        }
        try {
          const body = (await readJsonBody(request)) as { ids?: unknown; groups?: unknown }
          const plugins = resolveIds(body.ids, body.groups)
          if (plugins.length === 0) {
            sendJson(response, 400, { error: 'no curated plugins selected' })
            return
          }
          const results = await runBatch(host, profile, plugins)
          sendJson(response, 200, { results, restartNeeded: true, profile })
        } catch (error) {
          progress.active = false
          const message = error instanceof Error ? error.message : String(error)
          host.logger?.warn(`[dsh-starter-pack] install failed: ${message}`)
          sendJson(response, 500, { error: message })
        }
      },
    }),

    host.webServer.register({
      kind: 'exact',
      path: '/dsh-starter-pack/apply-config',
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' })
          response.end()
          return
        }
        if (!sameOrigin(request)) {
          sendJson(response, 403, { error: 'untrusted origin' })
          return
        }
        try {
          const body = (await readJsonBody(request)) as { ids?: unknown }
          const plugins = resolveIds(body.ids, [])
          const applied = plugins.map((p) => ({ id: p.id, ...applyRecommendedConfig(profile, p) }))
          sendJson(response, 200, { applied })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          host.logger?.warn(`[dsh-starter-pack] apply-config failed: ${message}`)
          sendJson(response, 500, { error: message })
        }
      },
    }),
  ]
  return () => {
    for (const dispose of disposers) dispose()
  }
}
