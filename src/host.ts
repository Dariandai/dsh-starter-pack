/**
 * The slice of the harness host surface this plugin depends on. Structural
 * types only: they match the runtime service APIs without pulling in
 * monorepo-internal type dependencies.
 */

export interface WebServerService {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => void | Promise<void>
  }): () => void
}

/** The slice of a cordis loader entry the pack needs for live enable/disable. */
export interface LoaderEntry {
  options: { id?: string; name?: string; disabled?: boolean | null }
  fiber?: unknown
  update(options: { disabled: boolean | null }, create?: boolean, force?: boolean): Promise<void>
}

export interface StarterHost {
  webServer: WebServerService
  loader: { entries(): Iterable<LoaderEntry> }
  on?(event: string, callback: (fiber: { entry?: { options?: { name?: string } } }) => void): () => void
  logger?: { info?(message: string): void; warn(message: string): void }
}

export interface StarterConfig {
  /** Profile the pack installs into; matches the profile serving this UI. */
  profile: string
}
