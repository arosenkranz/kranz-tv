// In-memory stub for Cloudflare KV. Implements the subset of the
// `KVNamespace` API surface used by the shares server functions:
//   - get(key, options?)
//   - put(key, value, options?)  (supports `expirationTtl` in seconds)
//   - delete(key)
//   - list(options?)
//
// TTL is evaluated lazily at read time (not via a real timer) so tests can
// fast-forward by injecting a custom `now()` function.
//
// This is NOT a full KV implementation — it omits eventual-consistency
// simulation, metadata, and bulk operations. Add only what tests need.

export interface KVPutOptions {
  /** TTL in seconds, matching Cloudflare KV. */
  expirationTtl?: number
  /** Absolute expiration epoch in seconds. */
  expiration?: number
}

export interface KVListOptions {
  prefix?: string
  limit?: number
  cursor?: string
}

export interface KVListResult {
  keys: ReadonlyArray<{ name: string; expiration?: number }>
  list_complete: boolean
  cursor?: string
}

export interface KVStub {
  get: ((key: string) => Promise<string | null>) &
    ((key: string, type: 'text') => Promise<string | null>) &
    (<T = unknown>(key: string, type: 'json') => Promise<T | null>)
  put: (key: string, value: string, options?: KVPutOptions) => Promise<void>
  delete: (key: string) => Promise<void>
  list: (options?: KVListOptions) => Promise<KVListResult>
  // Test-only:
  __reset: () => void
  __snapshot: () => Record<string, string>
  __setNow: (fn: () => number) => void
  __advanceTimeMs: (ms: number) => void
}

interface Entry {
  value: string
  /** Absolute expiration epoch in MS, or undefined if no TTL. */
  expiresAtMs?: number
}

export function createKvStub(): KVStub {
  const store = new Map<string, Entry>()
  let timeOffsetMs = 0
  let nowFn = (): number => Date.now() + timeOffsetMs

  const isExpired = (entry: Entry): boolean =>
    entry.expiresAtMs !== undefined && nowFn() >= entry.expiresAtMs

  const getRaw = (key: string): string | null => {
    const entry = store.get(key)
    if (entry === undefined) return null
    if (isExpired(entry)) {
      store.delete(key)
      return null
    }
    return entry.value
  }

  const stub: KVStub = {
    // Type-safe overloads against the runtime-shared implementation.
    get: (async (
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
    }) as KVStub['get'],

    async put(
      key: string,
      value: string,
      options?: KVPutOptions,
    ): Promise<void> {
      const entry: Entry = { value }
      if (options?.expirationTtl !== undefined) {
        entry.expiresAtMs = nowFn() + options.expirationTtl * 1000
      } else if (options?.expiration !== undefined) {
        entry.expiresAtMs = options.expiration * 1000
      }
      store.set(key, entry)
    },

    async delete(key: string): Promise<void> {
      store.delete(key)
    },

    async list(options?: KVListOptions): Promise<KVListResult> {
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
      return {
        keys: page,
        list_complete: page.length === matching.length,
      }
    },

    __reset(): void {
      store.clear()
      timeOffsetMs = 0
    },
    __snapshot(): Record<string, string> {
      const out: Record<string, string> = {}
      for (const [k, e] of store) {
        if (!isExpired(e)) out[k] = e.value
      }
      return out
    },
    __setNow(fn: () => number): void {
      nowFn = fn
    },
    __advanceTimeMs(ms: number): void {
      timeOffsetMs += ms
    },
  }

  return stub
}
