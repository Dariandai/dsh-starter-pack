/**
 * The `/setup` human command: list the curated groups, or install a batch of
 * them in one shot, without sending anything to the model.
 */

import { PACK, flatPlugins, type CuratedPlugin } from './registry.ts'
import { installPlugin, readInstalled, isPluginInstalled } from './installer.ts'
import { applyRecommendedConfig } from './configPatch.ts'

/** Subset of CommandResult we produce. */
export type SetupResult =
  | { kind: 'success'; text?: string }
  | { kind: 'error'; text: string }

function groupStatusLines(profile: string, installed: Record<string, string>): string[] {
  const lines: string[] = []
  for (const group of PACK) {
    lines.push(`**${group.title.zh}** (\`/setup ${group.id}\`)`)
    for (const plugin of group.plugins) {
      const mark = isPluginInstalled(profile, installed, plugin) ? '✅ 已装' : '·'
      lines.push(`- ${mark} ${plugin.name} — ${plugin.why.zh}`)
    }
  }
  return lines
}

async function installPlugins(profile: string, plugins: CuratedPlugin[]): Promise<string[]> {
  const lines: string[] = []
  const installed = readInstalled(profile)
  let failed = 0
  for (const plugin of plugins) {
    if (isPluginInstalled(profile, installed, plugin)) {
      lines.push(`· 跳过 ${plugin.name}(已安装)`)
      continue
    }
    const result = await installPlugin(profile, plugin)
    const ok = result.exitCode === 0 && !result.timedOut
    if (ok) {
      const configResult = applyRecommendedConfig(profile, plugin)
      const configNote = configResult.kind === 'applied' ? '已写入推荐配置' : ''
      lines.push(`✅ 安装 ${plugin.name}${configNote ? ' · ' + configNote : ''}`)
    } else {
      failed += 1
      lines.push(`❌ 失败 ${plugin.name}: ${(result.stderr || result.stdout).slice(-160)}`)
    }
  }
  if (failed > 0) {
    lines.push(`\n${failed} 个失败。请检查后重试,或改用设置页查看详情。`)
  } else {
    lines.push(`\n安装完成。重启 \`dsh web\` 让新插件生效。`)
  }
  return lines
}

export function runSetupCommand(profile: string, rawInput: string): Promise<SetupResult> {
  const args = rawInput.trim().split(/\s+/).filter(Boolean)

  if (args.length === 0) {
    const installed = readInstalled(profile)
    const lines = [
      '**DSH Starter Pack — 精选插件包**',
      '用法:`/setup <分组>` 安装一组(可多个,`/setup all` 装全部)。',
      '',
      ...groupStatusLines(profile, installed),
    ]
    return Promise.resolve({ kind: 'success', text: lines.join('\n') })
  }

  if (args[0].toLowerCase() === 'all') {
    return installPlugins(profile, flatPlugins()).then((lines) => ({ kind: 'success', text: lines.join('\n') }))
  }

  const requested = new Set(args.map((a) => a.toLowerCase()))
  const unknown = args.filter((a) => !PACK.some((g) => g.id === a.toLowerCase()))
  if (unknown.length > 0) {
    const valid = PACK.map((g) => g.id).join(', ')
    return Promise.resolve({ kind: 'error', text: `未知分组:${unknown.join(' ')}。可选:${valid}` })
  }
  const plugins = PACK.filter((g) => requested.has(g.id)).flatMap((g) => g.plugins)
  return installPlugins(profile, plugins).then((lines) => ({ kind: 'success', text: lines.join('\n') }))
}
