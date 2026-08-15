/**
 * dsh-starter-pack host entry: mounts the batch-install HTTP routes and the
 * `/setup` command once the profile composes webServer / loader / commands.
 */

import type { Context } from '@deepseek-ai/cordis'
import { mountRoutes } from './routes.ts'
import type { StarterHost, StarterConfig } from './host.ts'
import { runSetupCommand } from './command.ts'

export const name = 'dsh-starter-pack'

/** Optional cordis.yml configuration; profile defaults to the booted profile. */
export type Config = Partial<StarterConfig>

/**
 * The profile this host process actually booted (`--profile <name>` on the
 * dsh CLI invocation), so installs never mutate a profile other than the one
 * serving this UI.
 */
function argvProfile(): string | undefined {
  const argv = process.argv
  const flag = argv.indexOf('--profile')
  if (flag !== -1 && flag + 1 < argv.length && !argv[flag + 1].startsWith('-')) return argv[flag + 1]
  return undefined
}

interface CommandsService {
  register(definition: {
    name: string
    description: string
    input?: { hint: string }
    handler(invocation: { rawInput: string }): unknown
  }): () => void
}

export function apply(ctx: Context, config?: Config): void {
  const profile = config?.profile ?? argvProfile() ?? 'web'

  ctx.inject(['webServer', 'loader'], (hostCtx: Context) => {
    const host = hostCtx as unknown as StarterHost
    ctx.effect(() => mountRoutes(host, profile), 'dsh-starter-pack: http routes')
  })

  ctx.inject(['commands'], (cmdCtx: Context) => {
    const commands = (cmdCtx as unknown as { commands: CommandsService }).commands
    ctx.effect(
      () => commands.register({
        name: 'setup',
        description: 'DSH Starter Pack: list curated plugin groups, or install them in one shot.',
        input: { hint: 'essentials | dev | productivity | theme | all' },
        handler: (invocation) => runSetupCommand(profile, invocation.rawInput),
      }),
      'dsh-starter-pack: /setup command',
    )
  })
}
