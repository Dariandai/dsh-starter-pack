/**
 * The curated plugin registry for dsh-starter-pack.
 *
 * Every entry carries the install `target` verbatim (what `dsh plugin add`
 * receives: an npm package name, or a `github:owner/repo` spec), plus the
 * cordis loader `entryId` used to target config patches in the profile's
 * `cordis.patch.yml`. `recommendedConfig` is applied only where the host-side
 * config key is verified against the plugin's own manifest; otherwise the
 * plugin's curated defaults ARE the recommendation.
 *
 * Selection principles: necessity (fills a real gap), practicality (installs
 * reliably — npm prebuilt or build-free github), and authority (stars /
 * maintained org). Plugins that fail these are deliberately excluded; for
 * example dsh-toolkit currently cannot install because its dependency
 * @deepseek-ai/dsh-type-meta is missing from npm (harness discussion #984).
 */

export type GroupId = 'essentials' | 'external' | 'memory' | 'efficiency'

export interface CuratedPlugin {
  /** Stable slug; also the cordis loader entry id for config patches. */
  id: string
  /** The install target passed to `dsh plugin add` (npm name or github:owner/repo). */
  target: string
  /** Repo URL for the detail link. */
  url: string
  /** Short display name. */
  name: string
  /** Curated-registry category slug. */
  category: string
  /** GitHub stars, informational only. */
  stars: number
  /** One-line "why install this", per locale. */
  why: { zh: string; en: string }
  /** Verified host-side config to apply after install; omitted = keep defaults. */
  recommendedConfig?: Record<string, unknown>
}

export interface PackGroup {
  id: GroupId
  title: { zh: string; en: string }
  blurb: { zh: string; en: string }
  plugins: CuratedPlugin[]
}

export const PACK: PackGroup[] = [
  {
    id: 'essentials',
    title: { zh: '新手必备', en: 'Essentials' },
    blurb: {
      zh: '开箱即用的核心:插件商店与管理、侧边栏工作台、文件引用与 VS Code 打开。',
      en: 'The install-and-go core: a plugin store & manager, a sidebar workbench, file mentions and VS Code.',
    },
    plugins: [
      {
        id: 'dsh-market',
        target: 'dshmarket',
        url: 'https://github.com/dsh-market/dsh-market',
        name: 'dsh-market',
        category: 'tools',
        stars: 91,
        why: {
          zh: '内置插件商店:逛、搜、一键装社区全部插件。',
          en: 'An in-harness plugin store: browse, search and install anything in one click.',
        },
      },
      {
        id: 'dsh-plugin-hub',
        target: 'github:Noob-stupid/dsh-plugin-hub',
        url: 'https://github.com/Noob-stupid/dsh-plugin-hub',
        name: 'dsh-plugin-hub',
        category: 'ui',
        stars: 17,
        why: {
          zh: '插件管理面板:已装插件一键启停,附带 GitHub 插件市场。',
          en: 'A plugin management panel: one-click enable/disable installed plugins, plus a plugin market.',
        },
      },
      {
        id: 'better-sidebar',
        target: 'dsh-better-sidebar',
        url: 'https://github.com/omdsh-dev/DSH-better-sidebar',
        name: 'dsh-better-sidebar',
        category: 'ui',
        stars: 782,
        why: {
          zh: '侧边栏完整工作台:文件渲染编辑、终端、Git 与子代理一屏搞定。',
          en: 'Full sidebar workbench: file editing, terminal, Git and subagents.',
        },
      },
      {
        id: 'dsh-at-file',
        target: 'github:omdsh-dev/dsh-at-file',
        url: 'https://github.com/omdsh-dev/dsh-at-file',
        name: 'dsh-at-file',
        category: 'ui',
        stars: 145,
        why: {
          zh: '输入框里输入 @ 直接搜索并引用工作区文件,不用手打路径。',
          en: 'Type @ in the composer to search and attach workspace files.',
        },
      },
      {
        id: 'dsh-open-in-vscode',
        target: 'github:omdsh-dev/dsh-open-in-vscode',
        url: 'https://github.com/omdsh-dev/dsh-open-in-vscode',
        name: 'dsh-open-in-vscode',
        category: 'notify',
        stars: 40,
        why: {
          zh: 'Web 界面一键在 VS Code 中打开当前工作区目录。',
          en: 'Open the workspace directory in VS Code from the web UI.',
        },
      },
      {
        id: 'mirage',
        target: '@struktoai/mirage-dsh',
        url: 'https://github.com/strukto-ai/mirage',
        name: 'mirage',
        category: 'dev',
        stars: 3419,
        why: {
          zh: '生态第一的安全沙箱:把文件系统与命令执行换成虚拟环境,隔离测试不污染本机。',
          en: 'The #1 security sandbox: swap filesystem & bash for a virtual environment — isolate risky work.',
        },
      },
    ],
  },
  {
    id: 'external',
    title: { zh: '外部能力', en: 'External Capabilities' },
    blurb: {
      zh: '接入外部能力:视觉、联网搜索、MCP 服务器与上下文洞察。',
      en: 'Plug in external capabilities: vision, web search, MCP servers and context insight.',
    },
    plugins: [
      {
        id: 'modlens',
        target: '@liustack/modlens',
        url: 'https://github.com/liustack/modlens',
        name: 'modlens',
        category: 'tools',
        stars: 1376,
        why: {
          zh: '生态最火的视觉桥:粘贴图片即得结构化 JSON 证据(OCR/版面/语义)。',
          en: 'The top vision bridge: paste an image, get structured JSON evidence (OCR, layout, semantics).',
        },
      },
      {
        id: 'modsearch',
        target: '@liustack/modsearch',
        url: 'https://github.com/liustack/modsearch',
        name: 'modsearch',
        category: 'tools',
        stars: 94,
        why: {
          zh: '联网搜索桥:搜索网页与 X,返回带引用的结构化 JSON 证据。',
          en: 'Web search bridge: search the web and X, with structured JSON evidence and citations.',
        },
      },
      {
        id: 'dsh-mcp-bridge',
        target: 'dsh-mcp-bridge',
        url: 'https://github.com/Edge-Echo/dsh-mcp-bridge',
        name: 'dsh-mcp-bridge',
        category: 'tools',
        stars: 3,
        why: {
          zh: '精选 MCP 服务器全家桶:一键接入记忆/文件系统/GitHub/Playwright 等。',
          en: 'A curated MCP server bundle: memory, filesystem, GitHub, Playwright and more in one install.',
        },
      },
      {
        id: 'dsh-context',
        target: 'dsh-context',
        url: 'https://github.com/bowenliang123/dsh-context',
        name: 'dsh-context',
        category: 'ui',
        stars: 32,
        why: {
          zh: '上下文洞察面板:看清模型上下文窗口由什么构成、如何演进,控 token 更省。',
          en: 'Context insight panel: see what the model context window is made of and how it evolves.',
        },
      },
    ],
  },
  {
    id: 'memory',
    title: { zh: '记忆与技能', en: 'Memory & Skills' },
    blurb: {
      zh: '让 DSH 记住跨会话的事实,并管理你的技能库。',
      en: 'Persist facts across sessions and manage your skill library.',
    },
    plugins: [
      {
        id: 'dsh-mnemon',
        target: 'dsh-mnemon',
        url: 'https://github.com/omdsh-dev/dsh-mnemon',
        name: 'dsh-mnemon',
        category: 'memory',
        stars: 17,
        why: {
          zh: 'omdsh-dev 官方的本地优先三层记忆:运行时、可检索文档、受监督空间。',
          en: 'Official local-first three-tier memory: runtime, retrievable documents, supervised spaces.',
        },
      },
      {
        id: 'dsh-skill-manager',
        target: 'github:YTxue/dsh-skill-manager-ytxue',
        url: 'https://github.com/YTxue/dsh-skill-manager-ytxue',
        name: 'dsh-skill-manager',
        category: 'skill',
        stars: 3,
        why: {
          zh: '设置页 Skill 管理器:启停、批量导入、规范检查与自动修复。',
          en: 'A Settings-page skill manager: enable/disable, batch import, lint and auto-fix.',
        },
      },
    ],
  },
  {
    id: 'efficiency',
    title: { zh: '效率与外观', en: 'Productivity & Look' },
    blurb: {
      zh: '少盯屏、心里有数、看着顺眼:花费钱包、完成通知与换肤。',
      en: 'Stop babysitting the tab: a spend wallet, completion notifications and a nicer look.',
    },
    plugins: [
      {
        id: 'dsh-wallet',
        target: 'github:feibi-mochi/deepseek-harness-wallet',
        url: 'https://github.com/feibi-mochi/deepseek-harness-wallet',
        name: 'deepseek-harness-wallet',
        category: 'model',
        stars: 7,
        why: {
          zh: '多供应商钱包:官方余额、会话花费与 token、一键充值、低余额提醒。',
          en: 'Multi-provider wallet: balance, per-session cost & tokens, top-up and low-balance alerts.',
        },
      },
      {
        id: 'dsh-notification',
        target: 'github:omdsh-dev/dsh-notification',
        url: 'https://github.com/omdsh-dev/dsh-notification',
        name: 'dsh-notification',
        category: 'notify',
        stars: 41,
        why: {
          zh: '回合完成时发桌面通知,切到别的标签页也不错过。',
          en: 'Desktop notifications when a turn completes — no matter the tab.',
        },
      },
      {
        id: 'skin',
        target: 'dsh-skin',
        url: 'https://github.com/KinGao294/dsh-skin',
        name: 'dsh-skin',
        category: 'theme',
        stars: 10,
        why: {
          zh: 'Codex 风格换肤,外加带透明度与模糊控制的自定义壁纸。',
          en: 'Codex-style skin switcher plus a custom wallpaper with opacity/blur controls.',
        },
      },
    ],
  },
]

export function flatPlugins(): CuratedPlugin[] {
  return PACK.flatMap((group) => group.plugins)
}

export function findPlugin(id: string): CuratedPlugin | undefined {
  return flatPlugins().find((p) => p.id === id)
}
