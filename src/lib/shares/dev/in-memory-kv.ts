// In-memory KV namespace for `pnpm dev` and Playwright E2E.
// Mirrors the subset of Cloudflare KV's API used by the shares feature.
//
// Only loaded in dev — see vite.config.ts. Production deploys use real KV.

import type { KVNamespace } from '~/lib/shares/handlers'

interface Entry {
  value: string
  expiresAtMs?: number
}

export function createInMemoryKv(): KVNamespace {
  const store = new Map<string, Entry>()

  const isExpired = (entry: Entry): boolean =>
    entry.expiresAtMs !== undefined && Date.now() >= entry.expiresAtMs

  const getRaw = (key: string): string | null => {
    const entry = store.get(key)
    if (entry === undefined) return null
    if (isExpired(entry)) {
      store.delete(key)
      return null
    }
    return entry.value
  }

  const get = (async (
    key: string,
    type: 'text' | 'json' = 'text',
  ): Promise<unknown> => {
    const raw = getRaw(key)
    if (raw === null) return null
    if (type === 'json') {
      try {
        return JSON.parse(raw) as unknown
      } catch {
        return null
      }
    }
    return raw
  }) as KVNamespace['get']

  return {
    get,
    async put(key, value, options) {
      const entry: Entry = { value }
      if (options?.expirationTtl !== undefined) {
        entry.expiresAtMs = Date.now() + options.expirationTtl * 1000
      } else if (options?.expiration !== undefined) {
        entry.expiresAtMs = options.expiration * 1000
      }
      store.set(key, entry)
    },
    async delete(key) {
      store.delete(key)
    },
    async list(options) {
      const prefix = options?.prefix ?? ''
      const limit = options?.limit ?? 1000
      const matching: Array<{ name: string; expiration?: number }> = []
      for (const [name, entry] of store.entries()) {
        if (isExpired(entry)) {
          store.delete(name)
          continue
        }
        if (!name.startsWith(prefix)) continue
        const item: { name: string; expiration?: number } = { name }
        if (entry.expiresAtMs !== undefined) {
          item.expiration = Math.floor(entry.expiresAtMs / 1000)
        }
        matching.push(item)
      }
      matching.sort((a, b) => a.name.localeCompare(b.name))
      const page = matching.slice(0, limit)
      return { keys: page, list_complete: page.length === matching.length }
    },
  }
}
