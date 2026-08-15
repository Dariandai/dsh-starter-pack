# dsh-starter-pack

One-click curated plugin starter pack for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`). Install this one plugin, and it installs and configures a batch of the most useful community plugins for you.

> 中文说明见 [README.zh.md](README.zh.md)。

## Why

New DSH users face 400+ community plugins and no idea which to install. `dsh-starter-pack` is the "essentials bundle": a vetted, grouped list of the plugins worth having, installed in one click.

## Install

```sh
dsh plugin --profile web add dsh-starter-pack
```

Restart `dsh web`, then open **Settings → Starter Pack**, or run `/setup`.

## Usage

**Settings → Starter Pack** — pick groups and hit **Install selected**:

![Starter Pack settings](assets/starter-pack-settings.png)

**Slash command** — no UI needed:

```text
/setup                    # list groups and per-plugin status
/setup essentials         # install one group
/setup external efficiency  # install several groups
/setup all                # install everything
```

Installed plugins appear with an "Installed" badge and are skipped on re-runs. New plugins take effect after a restart of `dsh web`.

## The curated groups

- **新手必备 (Essentials)** — plugin store & manager, sidebar workbench, `@file` mentions, VS Code open, and a security sandbox (mirage).
- **外部能力 (External Capabilities)** — vision (modlens), web search (modsearch), an MCP bundle, and a context-insight panel.
- **记忆与技能 (Memory & Skills)** — persistent cross-session memory (dsh-mnemon) and a skill manager.
- **效率与外观 (Productivity & Look)** — a multi-provider spend wallet, turn notifications, and a skin switcher.

Each entry lists why it's recommended, with a link to its repo. The list is curated by necessity, practicality and authority — plugins that fail to install reliably (e.g. dsh-toolkit, whose dependency `@deepseek-ai/dsh-type-meta` is missing from npm, harness discussion #984) are deliberately excluded.

## How it works

- The pack ships a curated registry (`src/registry.ts`). On install it calls `dsh plugin --profile <profile> add <target>` for each selected plugin — npm packages when prebuilt, `github:owner/repo` otherwise — skipping anything already present.
- **Build scripts**: git-hosted plugins often ship a `prepare` step that pnpm blocks by default. The pack treats itself as the trust decision: on the first blocked build it sets `allowBuilds` (including a `'*': true` catch-all) in the profile's `pnpm-workspace.yaml` and retries. You can edit that file later to restore pnpm's defaults.
- **Recommended config**: plugins that expose a verified host-side config key get a patch written into the profile's `cordis.patch.yml` (merge-only, idempotent). Most curated plugins run on their defaults, which is the recommendation.
- Installs run through `child_process` re-invoking the running `dsh` binary, mirroring how `dsh-market` installs plugins.

## Development

```sh
pnpm install
pnpm run check      # typecheck (host + client) + build
npm pack            # produce the publishable tarball
```

The client bundle is built with `tsdown` and wraps into the harness `__ModuleLoader__` contract (`scripts/normalize-client-banner.mjs`, guarded by `scripts/preflight.mjs`).

## License

MIT
