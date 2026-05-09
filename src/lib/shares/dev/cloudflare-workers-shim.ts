// Dev-only shim for `cloudflare:workers`.
//
// `vite dev` doesn't activate Nitro's Cloudflare preset, so the
// `cloudflare:workers` virtual module isn't resolved by default. This file
// fills the gap by lazily creating an in-memory KV namespace on first access.
//
// Each Vite/Nitro worker process gets its own `__env__` cache. That's fine
// for single-process E2E tests and `pnpm dev` — both run a single worker.
//
// In production, Nitro's Cloudflare preset replaces this import via its
// own alias. See `node_modules/nitro-nightly/dist/_presets.mjs` line 550.

import { createInMemoryKv } from './in-memory-kv'

interface DevEnvHolder {
  __env__?: Record<string, unknown>
}

function ensureEnv(): Record<string, unknown> {
  const g = globalThis as unknown as DevEnvHolder
  if (g.__env__ === undefined) {
    g.__env__ = {}
  }
  if (!('SHARED_CHANNELS_KV' in g.__env__)) {
    g.__env__.SHARED_CHANNELS_KV = createInMemoryKv()
  }
  return g.__env__
}

export const env = new Proxy(
  {},
  {
    get(_target, prop) {
      return ensureEnv()[prop as string]
    },
    has(_target, prop) {
      return prop in ensureEnv()
    },
    ownKeys() {
      return Reflect.ownKeys(ensureEnv())
    },
    getOwnPropertyDescriptor(_target, prop) {
      const e = ensureEnv()
      if (prop in e) {
        return {
          value: e[prop as string],
          writable: true,
          enumerable: true,
          configurable: true,
        }
      }
      return undefined
    },
  },
) as Record<string, unknown>

export async function waitUntil(promise: Promise<unknown>): Promise<void> {
  await promise.catch(() => {
    /* swallow — Cloudflare's runtime ignores rejections after response */
  })
}
