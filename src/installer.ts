/**
 * Plugin install engine: spawns `dsh plugin add/remove` (re-invoking the CLI
 * that launched this host) and reports the profile's installed packages.
 *
 * The install path mirrors dsh-market: child_process (not ctx.shell) because
 * the shell service is the agent's sandboxed executor and denies writes to
 * the profile directory. Windows npm/corepack/pnpm are .cmd shims that Node
 * `spawn` cannot start without a shell, so win32 falls back to a bare `dsh`
 * through the shell.
 */

import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { CuratedPlugin } from './registry.ts'

const INSTALL_TIMEOUT_MS = 5 * 60 * 1000

/** Windows npm/corepack/pnpm are `.cmd` shims; spawn needs a shell to start them. */
const winCmdShim = process.platform === 'win32'

export interface InstallResult {
  exitCode: number | null
  timedOut: boolean
  stdout: string
  stderr: string
}

/**
 * Argv re-invoking the CLI that launched this host process, so installs work
 * whether dsh runs from a global bin, a local install, or repo source. Falls
 * back to a PATH `dsh`.
 */
function dshArgv(): { file: string; args: string[]; cwd: string | undefined; viaShell: boolean } {
  const entry = process.argv[1]
  if (entry !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(entry)) {
    const abs = resolve(entry)
    return { file: process.execPath, args: [...process.execArgv, abs], cwd: dirname(abs), viaShell: false }
  }
  // Bare `dsh` is a .cmd shim on Windows that only a shell can start.
  return { file: 'dsh', args: [], cwd: undefined, viaShell: winCmdShim }
}

/** Kill a spawned child and, on Windows, its whole process tree. */
function killChild(child: ChildProcess): void {
  if (process.platform === 'win32' && child.pid !== undefined) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
      return
    } catch { /* fall through */ }
  }
  child.kill('SIGKILL')
}

/** Central allowlist for every spawn target (defense in depth). */
const TARGET_RE = /^[A-Za-z0-9@:./_#+-]+$/

export function runDshPlugin(profile: string, pluginArgs: string[]): Promise<InstallResult> {
  const { file, args, cwd, viaShell } = dshArgv()
  // pnpm 9 refuses to add at a workspace root without -w; pnpm 10/11 accept
  // the flag as a no-op there, so it is safe to pass always.
  if (pluginArgs[0] === 'add' || pluginArgs[0] === 'remove') {
    pluginArgs = [pluginArgs[0], '-w', ...pluginArgs.slice(1)]
  }
  const target = pluginArgs[pluginArgs.length - 1] ?? ''
  if (!TARGET_RE.test(target)) {
    return Promise.resolve({ exitCode: 1, timedOut: false, stdout: '', stderr: `unsafe plugin target rejected: ${JSON.stringify(target)}` })
  }
  return new Promise((resolvePromise) => {
    const child = spawn(file, [...args, 'plugin', '--profile', profile, ...pluginArgs], {
      cwd,
      // pnpm v10 blocks forever on a silent interactive prompt without a TTY;
      // CI mode forces it to act or fail instead of asking.
      env: { ...process.env, CI: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: viaShell,
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      killChild(child)
    }, INSTALL_TIMEOUT_MS)
    child.stdout.on('data', (chunk: Buffer) => { stdout = (stdout + chunk.toString()).slice(-256 * 1024) })
    child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-64 * 1024) })
    child.on('error', (error) => {
      clearTimeout(timer)
      resolvePromise({ exitCode: 127, timedOut: false, stdout, stderr: `${stderr}\n${error.message}` })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolvePromise({ exitCode: code, timedOut, stdout, stderr })
    })
  })
}

/** Profile directory hosting the profile's package.json / node_modules. */
export function profileDir(profile: string): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'profiles', profile)
}

/** Dependencies of the profile. Kept unfiltered: some community plugins name
 * themselves under `@deepseek-ai/` (e.g. dsh-plugin-hub ships as
 * `@deepseek-ai/dsh-plugin-console`), so a scope filter would hide them. */
export function readInstalled(profile: string): Record<string, string> {
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir(profile), 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    return { ...(manifest.dependencies ?? {}) }
  } catch {
    return {}
  }
}

export function readInstalledVersion(profile: string, name: string): string | null {
  try {
    const manifest = JSON.parse(
      readFileSync(join(profileDir(profile), 'node_modules', name, 'package.json'), 'utf8'),
    ) as { version?: string }
    return manifest.version ?? null
  } catch {
    return null
  }
}

/** Parse a `github:owner/repo` spec's repo slug. */
function githubRepoOf(spec: string): string | null {
  const m = /^github:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:#.*)?$/.exec(spec)
  return m === null ? null : m[1].toLowerCase()
}

/**
 * Extract the repo slug from any of the dependency-spec shapes pnpm writes
 * for a GitHub install: `github:owner/repo`, `git+https://github.com/owner/repo.git`,
 * or `https://github.com/owner/repo`.
 */
function repoSlugOf(spec: string): string | null {
  const m = /github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?(?:#.*)?$/.exec(spec)
  return m === null ? null : m[1].toLowerCase()
}

function isGithubTarget(target: string): boolean {
  return target.startsWith('github:')
}

/** Whether the curated plugin is actually installed (dep recorded AND package present). */
export function isPluginInstalled(profile: string, installed: Record<string, string>, plugin: CuratedPlugin): boolean {
  const hasPackage = (name: string): boolean =>
    existsSync(join(profileDir(profile), 'node_modules', name, 'package.json'))
  if (!isGithubTarget(plugin.target)) {
    return installed[plugin.target] !== undefined && hasPackage(plugin.target)
  }
  const repo = githubRepoOf(plugin.target)
  if (repo === null) return false
  for (const [name, spec] of Object.entries(installed)) {
    if (repoSlugOf(spec) === repo && hasPackage(name)) return true
  }
  return false
}

/** Add spec passed to `dsh plugin add` for a curated plugin (its curated target). */
export function addTarget(plugin: CuratedPlugin): string {
  return plugin.target
}

/** Directory where an installed plugin's package.json lives, if present. */
export function installedPackageDir(profile: string, name: string): string | null {
  const dir = join(profileDir(profile), 'node_modules', name)
  return existsSync(join(dir, 'package.json')) ? dir : null
}

/** Profile pnpm-workspace.yaml path (where pnpm's allowBuilds lives). */
export function profileWorkspaceFile(profile: string): string {
  return join(profileDir(profile), 'pnpm-workspace.yaml')
}

/** Whether a plugin-add failure is caused by pnpm blocking build scripts. */
export function hasBuildBlock(output: string): boolean {
  return output.includes('ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED') || output.includes('ERR_PNPM_IGNORED_BUILDS')
}

/**
 * Allow all build scripts in the profile's pnpm-workspace.yaml. A curated
 * starter pack is the trust decision: git-hosted plugins (and their
 * transitive build deps such as node-pty) need their prepare scripts to run.
 *
 * The profile is dsh-managed: it may carry `allowBuilds` placeholder values
 * ("set this to true or false") and a `minimumReleaseAgeExclude` policy. This
 * rewrite sets every `allowBuilds` entry to `true` (fixing placeholders) plus
 * a `'*': true` catch-all, and leaves every other key untouched. Idempotent;
 * the user can edit the file to restore pnpm's default.
 */
export function approveAllBuilds(profile: string): boolean {
  const file = profileWorkspaceFile(profile)
  try {
    const raw = existsSync(file) ? readFileSync(file, 'utf8') : ''
    let doc: Record<string, unknown>
    if (raw.trim() === '') {
      doc = {}
    } else {
      const parsed = parseYaml(raw)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return false
      doc = parsed as Record<string, unknown>
    }
    const allow = (doc.allowBuilds as Record<string, unknown> | undefined) ?? {}
    for (const key of Object.keys(allow)) allow[key] = true
    allow['*'] = true
    doc.allowBuilds = allow
    writeFileSync(file, stringifyYaml(doc, { indent: 2, lineWidth: 0 }))
    return true
  } catch {
    return false
  }
}

/**
 * Install one curated plugin, approving build scripts (pnpm blocks the
 * prepare step of git-hosted packages) and retrying until the install settles.
 */
export async function installPlugin(profile: string, plugin: CuratedPlugin): Promise<InstallResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await runDshPlugin(profile, ['add', plugin.target])
    if (result.exitCode === 0 && !result.timedOut) return result
    if (!hasBuildBlock(result.stdout + result.stderr) || !approveAllBuilds(profile)) return result
  }
  return { exitCode: 1, timedOut: false, stdout: '', stderr: 'build approval did not resolve install' }
}
