/**
 * dsh-starter-pack client entry: registers a "Starter Pack" settings section
 * rendering the curated plugin pack UI.
 *
 * Built by tsdown into the __ModuleLoader__ factory bundle at client/client.js.
 */

import { createElement as h } from 'react'
import { zh, en } from './locales.ts'
import { PackSection } from './PackSection.tsx'

const NS = 'dsh-starter-pack'

/** The subset of the locale service this plugin touches. */
interface LocaleService {
  register(namespace: string, dicts: { zh: Record<string, string>; en: Record<string, string> }): unknown
  bind(namespace: string): (key: string, vars?: Record<string, unknown>) => string
  subscribe(callback: () => void): () => void
  getSnapshot(): { active: string }
}

/** The subset of the slots service this plugin touches. */
interface SlotsService {
  inject(slot: string, register: () => unknown): void
  register(meta: Record<string, unknown>, component: () => unknown): unknown
}

/** The client cordis context shape this plugin relies on (structural). */
interface PackClientContext {
  effect(callback: () => unknown, label?: string): void
  locale: LocaleService
  slots: SlotsService
}

export const name = 'dsh-starter-pack'
export const inject = ['slots', 'locale']

export function apply(ctx: PackClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-starter-pack: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'starter-pack',
    order: 60,
    label: () => t('nav'),
    locale: NS,
    inject: () => ({ t }),
  }, () => h(PackSection, { t })))
}
