/**
 * Settings-page UI for dsh-starter-pack: curated groups with per-plugin
 * status, group/global select-all, and a one-click batch install.
 */

import { useEffect, useState } from 'react'
import { createElement as h, type ReactElement, type ChangeEvent } from 'react'

interface RegistryPlugin {
  id: string
  name: string
  url: string
  category: string
  stars: number
  why: { zh: string; en: string }
  installed: boolean
  version: string | null
  /** Client-side selection state, not part of the registry payload. */
  _checked?: boolean
}

interface RegistryGroup {
  id: string
  title: { zh: string; en: string }
  blurb: { zh: string; en: string }
  plugins: RegistryPlugin[]
}

interface BatchResult {
  id: string
  name: string
  status: 'installed' | 'skipped' | 'failed'
  note?: string
}

interface Props {
  t: (key: string, vars?: Record<string, unknown>) => string
}

const card: Record<string, string | number> = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '14px 16px',
  border: '1px solid var(--dsh-color-border, rgba(128,128,128,0.25))',
  borderRadius: 10,
  background: 'var(--dsh-color-surface-2, rgba(128,128,128,0.06))',
}

const row: Record<string, string | number> = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
}

const muted: Record<string, string | number> = { opacity: 0.6, fontSize: 13 }

const buttonStyle: Record<string, string | number> = {
  padding: '6px 14px',
  borderRadius: 8,
  border: '1px solid rgba(128,128,128,0.35)',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13,
}

export function PackSection({ t }: Props): ReactElement {
  const [groups, setGroups] = useState<RegistryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<BatchResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = (): void => {
    setLoading(true)
    fetch('/dsh-starter-pack/registry')
      .then((r) => (r.ok ? r.json() as Promise<{ groups: RegistryGroup[] }> : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => { setGroups(data.groups); setResults(null); setError(null) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
    fetch('/dsh-starter-pack/stars')
      .then((r) => (r.ok ? r.json() as Promise<{ stars: Record<string, number> }> : Promise.resolve({ stars: {} as Record<string, number> })))
      .then(({ stars }) => {
        if (Object.keys(stars).length === 0) return
        setGroups((prev) => prev.map((g) => ({ ...g, plugins: g.plugins.map((p) => (stars[p.id] !== undefined ? { ...p, stars: stars[p.id] } : p)) })))
      })
      .catch(() => {})
  }

  useEffect(load, [])

  const selectedCount = groups.flatMap((g) => g.plugins).filter((p) => p._checked && !p.installed).length
  const anyChecked = selectedCount > 0

  const toggle = (pluginId: string, value: boolean): void => {
    setGroups((prev) => prev.map((g) => ({
      ...g,
      plugins: g.plugins.map((p) => (p.id === pluginId ? { ...p, _checked: value } : p)),
    })))
  }

  /** Select or clear every not-yet-installed plugin, optionally within one group. */
  const setAll = (value: boolean, groupId?: string): void => {
    setGroups((prev) => prev.map((g) => {
      if (groupId !== undefined && g.id !== groupId) return g
      return { ...g, plugins: g.plugins.map((p) => (p.installed ? p : { ...p, _checked: value })) }
    }))
  }

  const install = (): void => {
    const ids = groups.flatMap((g) => g.plugins.filter((p) => p._checked && !p.installed).map((p) => p.id))
    if (ids.length === 0) return
    setBusy(true)
    setError(null)
    void fetch('/dsh-starter-pack/install', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
      .then((r) => (r.ok ? r.json() as Promise<{ results: BatchResult[]; restartNeeded: boolean }> : r.json().then((j) => Promise.reject(new Error((j as { error?: string }).error ?? `HTTP ${r.status}`)))))
      .then((data) => { setResults(data.results); load() })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false))
  }

  const failed = (results ?? []).filter((r) => r.status === 'failed')

  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } }, [
    h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } }, [
      h('h2', { key: 'title', style: { margin: 0, fontSize: 18 } }, t('title')),
      h('button', { key: 'select', onClick: () => setAll(true), disabled: busy, style: buttonStyle }, t('selectAll')),
      h('button', { key: 'clear', onClick: () => setAll(false), disabled: busy, style: buttonStyle }, t('clearSelection')),
      h('button', { key: 'refresh', onClick: load, style: buttonStyle }, t('refresh')),
      selectedCount > 0 && h('span', { key: 'count', style: muted }, t('selected', { n: selectedCount })),
    ]),

    error !== null && h('div', { key: 'error', style: { ...card, color: '#d66' } }, error),

    loading && h('div', { key: 'loading', style: muted }, t('loading')),

    !loading &&
      groups.map((group) =>
        h('section', { key: group.id, style: { display: 'flex', flexDirection: 'column', gap: 8 } }, [
          h('div', { key: 'gt', style: { display: 'flex', alignItems: 'center', gap: 10 } }, [
            h('h3', { key: 't', style: { margin: 0, fontSize: 15 } }, group.title.zh),
            h('button', {
              key: 'gs',
              onClick: () => setAll(true, group.id),
              disabled: busy,
              style: { ...buttonStyle, padding: '2px 10px', fontSize: 12 },
            }, t('selectGroup')),
          ]),
          h('div', { key: 'b', style: muted }, group.blurb.zh),
          group.plugins.map((plugin) =>
            h('label', { key: plugin.id, style: { ...card, cursor: 'pointer' } }, [
              h('div', { key: 'r', style: row }, [
                h('input', {
                  key: 'c',
                  type: 'checkbox',
                  checked: plugin._checked === true,
                  disabled: busy || plugin.installed,
                  onChange: (e: ChangeEvent<HTMLInputElement>) => toggle(plugin.id, e.target.checked),
                  style: { accentColor: '#4d6bfe' },
                }),
                h('a', { key: 'n', href: plugin.url, target: '_blank', rel: 'noreferrer', style: { fontWeight: 600, color: 'inherit' } }, plugin.name),
                h('span', { key: 's', style: muted }, `★${plugin.stars}`),
                h('span', {
                  key: 'st',
                  style: {
                    marginLeft: 'auto',
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: plugin.installed ? 'rgba(90,200,120,0.18)' : 'rgba(128,128,128,0.15)',
                  },
                }, plugin.installed ? t('alreadyInstalled') : t('notInstalled')),
              ]),
              h('div', { key: 'why', style: muted }, plugin.why.zh),
            ]),
          ),
        ]),
      ),

    h('div', { key: 'actions', style: { display: 'flex', alignItems: 'center', gap: 12 } }, [
      h('button', {
        key: 'install',
        onClick: install,
        disabled: busy || anyChecked === false,
        style: { ...buttonStyle, background: anyChecked ? '#4d6bfe' : undefined, color: anyChecked ? '#fff' : undefined },
      }, busy ? t('installing') : t('installSelected')),
    ]),

    results !== null && h('div', { key: 'results', style: { display: 'flex', flexDirection: 'column', gap: 4 } }, [
      ...results.map((r) =>
        h('div', { key: r.id, style: row }, [
          h('span', { key: 'mark', style: { width: 60, fontSize: 13 } }, resultLabel(r.status, t)),
          h('span', { key: 'name', style: { fontSize: 13 } }, r.name),
          r.note !== undefined && h('span', { key: 'note', style: muted }, r.note),
        ]),
      ),
      failed.length === 0 && h('div', { key: 'restart', style: { ...muted, marginTop: 6 } }, t('restartNeeded')),
    ]),
  ])
}

function resultLabel(status: BatchResult['status'], t: Props['t']): string {
  switch (status) {
    case 'installed': return t('installOk')
    case 'skipped': return t('installSkipped')
    case 'failed': return t('installFailed')
  }
}
