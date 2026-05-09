// MUST NOT be statically prerendered — every handler reads/writes Cloudflare KV
// at request time. Prerendering would 404 every share or serve stale data.
//
// KV access pattern: import `env` from `cloudflare:workers`. Nitro's dev plugin
// shims this module to use `unenv`'s process.env in vite dev; the real module
// is provided by the Cloudflare runtime in production. Same import works in
// wrangler dev, vite dev, and production deploy.
//
// Verified against TanStack Start 1.166.x + Nitro 3.0.x (T020.5 spike).

import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import {
  publishShareImpl,
  resolveShareImpl,
  revokeShareImpl,
} from '~/lib/shares/handlers'
import type {
  KVNamespace,
  ShareEnv,
  ShareMetricsSink,
} from '~/lib/shares/handlers'
import { getRequestUrl, setResponseHeaders } from '@tanstack/react-start/server'
import { incrementMetric, recordHistogram } from '~/lib/datadog/server-metrics'
import { setShareTransport } from '~/lib/shares/share-client'

// Build the shared metrics sink once. Server-metrics emit no-op when no
// DD_AGENT_HOST is configured — safe in dev, propagates in Docker.
const sink: ShareMetricsSink = {
  count(name, tags) {
    incrementMetric(name, tags)
  },
  histogram(name, valueMs, tags) {
    recordHistogram(name, valueMs, tags)
  },
}

function getShareEnv(): ShareEnv {
  const SHARED_CHANNELS_KV = (
    env as unknown as {
      SHARED_CHANNELS_KV?: KVNamespace
    }
  ).SHARED_CHANNELS_KV
  if (SHARED_CHANNELS_KV === undefined) {
    throw new Error(
      'SHARED_CHANNELS_KV binding is missing — check wrangler.jsonc',
    )
  }
  // Resolve origin from the incoming request — TanStack Start's getRequestUrl
  // honors `x-forwarded-host`/`x-forwarded-proto` for proxied environments.
  const origin = getRequestUrl().origin
  return { SHARED_CHANNELS_KV, origin, metrics: sink }
}

// ── Server functions ────────────────────────────────────────────────────

export const publishShare = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => data)
  .handler(async ({ data }) => publishShareImpl(data, getShareEnv()))

export const resolveShare = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => data)
  .handler(async ({ data }) => {
    const result = await resolveShareImpl(data, getShareEnv())
    if (result.ok) {
      // Cache resolves at the edge for 60s, plus a 10-minute SWR window.
      // After the first resolve, the recipient persists locally and never
      // queries again (FR-008) — this header is for the cold-start surge.
      setResponseHeaders({
        'cache-control': result.value.cacheControl,
      })
    }
    return result
  })

export const revokeShare = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => data)
  .handler(async ({ data }) => revokeShareImpl(data, getShareEnv()))

// Wire the client transport. The client module imports the transport-setter
// only; the server functions themselves are tree-shaken from client bundles
// because they live behind `createServerFn` (which Vite splits at build).
setShareTransport({
  publish: (input) => publishShare({ data: input }),
  resolve: (input) => resolveShare({ data: input }),
  revoke: (input) => revokeShare({ data: input }),
})

export const Route = createFileRoute('/api/shares')({
  // No UI — this route exposes the three server functions via createServerFn.
  // Call them directly from client code via the wrappers in `~/lib/shares/share-client`.
})
