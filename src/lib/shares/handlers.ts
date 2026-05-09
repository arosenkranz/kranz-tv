// Server-side handler implementations for the shares feature.
//
// These pure functions take an explicit `env` (containing the KV binding)
// and an optional `now` clock so tests can drive them without spinning up
// the Cloudflare runtime. The thin createServerFn wrappers in
// `src/routes/api/shares.ts` resolve env from the runtime context.
//
// Spec sources:
//   - specs/002-shared-channels/contracts/shares-api.md
//   - specs/002-shared-channels/data-model.md
//   - specs/002-shared-channels/research.md (R4 idempotency, R5 rate-limit)

import {
  PublishPayloadSchema,
  ResolvePayloadSchema,
  RevokePayloadSchema,
  ShareRecordSchema,
  normalizeSourceUrl,
} from './share-record'
import type {
  PublicShareRecord,
  PublishPayload,
  ShareRecord,
  ShareResult,
} from './share-record'
import { generateShareId, normalizeShareId } from './share-id'

/**
 * Minimal Cloudflare KV interface — exactly the subset of operations this
 * feature uses. Pulling in `@cloudflare/workers-types` would drag in ~1.4MB
 * of declarations for stable API surface we already cover here.
 */
export interface KVNamespace {
  get: ((key: string) => Promise<string | null>) &
    ((key: string, type: 'text') => Promise<string | null>) &
    (<T = unknown>(key: string, type: 'json') => Promise<T | null>)
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number; expiration?: number },
  ) => Promise<void>
  delete: (key: string) => Promise<void>
  list: (options?: {
    prefix?: string
    limit?: number
    cursor?: string
  }) => Promise<{
    keys: ReadonlyArray<{ name: string; expiration?: number }>
    list_complete: boolean
    cursor?: string
  }>
}

/**
 * Runtime environment for share handlers. The Cloudflare-runtime wrapper
 * resolves `SHARED_CHANNELS_KV` from `env.context.cloudflare.env`; tests
 * inject the KV stub directly.
 */
export interface ShareEnv {
  SHARED_CHANNELS_KV: KVNamespace
  /** Origin used to build absolute share URLs (e.g., 'https://kranz.tv'). */
  origin: string
  /**
   * Optional metrics sink. The runtime wrapper supplies a sink backed by
   * `~/lib/datadog/server-metrics`; tests omit it to keep handler logic
   * uncoupled from observability. When present, every handler emits a
   * counter tagged with `outcome:<...>` and a `_ms` histogram.
   */
  metrics?: ShareMetricsSink
}

export interface ShareMetricsSink {
  count: (name: string, tags: Record<string, string>) => void
  histogram: (
    name: string,
    valueMs: number,
    tags?: Record<string, string>,
  ) => void
}

const RATE_LIMIT_PER_HOUR = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const IDEMPOTENCY_TTL_DAYS = 30
const IDEMPOTENCY_TTL_SECONDS = IDEMPOTENCY_TTL_DAYS * 24 * 60 * 60
const SHARE_ID_COLLISION_RETRIES = 3

interface RateLimitState {
  readonly count: number
  readonly windowStart: number
}

interface PublishSuccess {
  readonly shareId: string
  readonly shareUrl: string
  readonly isNew: boolean
}

export async function publishShareImpl(
  rawPayload: unknown,
  env: ShareEnv,
  nowMs: () => number = Date.now,
): Promise<ShareResult<PublishSuccess>> {
  const startedAt =
    typeof performance !== 'undefined' ? performance.now() : nowMs()
  const finish = (
    result: ShareResult<PublishSuccess>,
    outcome: string,
  ): ShareResult<PublishSuccess> => {
    if (env.metrics) {
      const elapsed =
        (typeof performance !== 'undefined' ? performance.now() : nowMs()) -
        startedAt
      env.metrics.count('kranz_tv.share.publish', { outcome })
      env.metrics.histogram('kranz_tv.share.publish_ms', elapsed, { outcome })
    }
    return result
  }

  // 1. Validate the payload.
  const parsed = PublishPayloadSchema.safeParse(rawPayload)
  if (!parsed.success) {
    return finish(
      {
        ok: false,
        error: 'invalid_payload',
        message: parsed.error.issues[0]?.message ?? 'Invalid payload',
      },
      'invalid',
    )
  }
  const payload = parsed.data

  try {
    // 2. Hash the credential.
    const credentialHash = await sha256Hex(payload.credential)

    // 3. Rate-limit check.
    const rateLimit = await getRateLimit(env.SHARED_CHANNELS_KV, credentialHash)
    const now = nowMs()
    const inWindow =
      rateLimit !== null && now - rateLimit.windowStart < RATE_LIMIT_WINDOW_MS
    if (inWindow && rateLimit.count >= RATE_LIMIT_PER_HOUR) {
      return finish(
        {
          ok: false,
          error: 'rate_limited',
          message:
            "You've published too many shares in the last hour. Try again later.",
          retryAfterMs: Math.max(
            0,
            rateLimit.windowStart + RATE_LIMIT_WINDOW_MS - now,
          ),
        },
        'rate_limited',
      )
    }

    // 4. Idempotency lookup.
    const normalizedUrl = normalizeSourceUrl(
      payload.channel.sourceUrl,
      payload.channel.kind,
    )
    const idempotencyKey = await sha256Hex(
      `${payload.credential}:${normalizedUrl}`,
    )
    const existingShareId = await env.SHARED_CHANNELS_KV.get(
      `idempotency:${idempotencyKey}`,
    )
    if (existingShareId !== null) {
      return finish(
        {
          ok: true,
          value: {
            shareId: existingShareId,
            shareUrl: `${trimTrailingSlash(env.origin)}/s/${existingShareId}`,
            isNew: false,
          },
        },
        'success',
      )
    }

    // 5. Mint a new shareId with collision retry.
    let shareId: string | null = null
    for (let attempt = 0; attempt < SHARE_ID_COLLISION_RETRIES; attempt++) {
      const candidate = generateShareId()
      const collision = await env.SHARED_CHANNELS_KV.get(`share:${candidate}`)
      if (collision === null) {
        shareId = candidate
        break
      }
    }
    if (shareId === null) {
      // 1-in-10^9-event territory; surface as kv_unavailable so the
      // client can retry rather than presenting a bad error.
      return finish(
        {
          ok: false,
          error: 'kv_unavailable',
          message: 'Could not allocate a share id — please retry.',
        },
        'kv_error',
      )
    }

    // 6. Build the record and persist.
    //    Order: write `share:<id>` first (canonical data), then
    //    `idempotency:<key>` (lookup index). If step 2 fails after step 1
    //    succeeds, we have an orphan record — but that's harmless: the
    //    sharer's UI will treat the next publish as `isNew: true` and we'll
    //    overwrite the share record. Worst case is a duplicate KV entry.
    const record: ShareRecord = {
      shareId,
      kind: payload.channel.kind,
      sourceUrl: normalizedUrl,
      name: payload.channel.name.trim(),
      description: payload.channel.description?.trim() || null,
      createdAt: now,
      revokedAt: null,
      credentialHash,
    }
    // Validate the record we're about to write — defensive against any
    // future schema drift between PublishPayload and ShareRecord.
    const validated = ShareRecordSchema.safeParse(record)
    if (!validated.success) {
      return finish(
        {
          ok: false,
          error: 'invalid_payload',
          message: 'Internal validation failure',
        },
        'invalid',
      )
    }

    await env.SHARED_CHANNELS_KV.put(
      `share:${shareId}`,
      JSON.stringify(validated.data),
    )
    await env.SHARED_CHANNELS_KV.put(`idempotency:${idempotencyKey}`, shareId, {
      expirationTtl: IDEMPOTENCY_TTL_SECONDS,
    })

    // 7. Increment rate-limit counter.
    await bumpRateLimit(env.SHARED_CHANNELS_KV, credentialHash, rateLimit, now)

    return finish(
      {
        ok: true,
        value: {
          shareId,
          shareUrl: `${trimTrailingSlash(env.origin)}/s/${shareId}`,
          isNew: true,
        },
      },
      'success',
    )
  } catch (err) {
    return finish(
      {
        ok: false,
        error: 'kv_unavailable',
        message:
          err instanceof Error
            ? `KV operation failed: ${err.message}`
            : 'KV operation failed',
      },
      'kv_error',
    )
  }
}

// ── resolveShareImpl ────────────────────────────────────────────────────

const RESOLVE_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=600'

interface ResolveSuccess {
  readonly record: PublicShareRecord
  readonly cacheControl: string
}

export async function resolveShareImpl(
  rawPayload: unknown,
  env: ShareEnv,
  nowMs: () => number = Date.now,
): Promise<ShareResult<ResolveSuccess>> {
  const startedAt =
    typeof performance !== 'undefined' ? performance.now() : nowMs()
  const finish = (
    result: ShareResult<ResolveSuccess>,
    outcome: string,
  ): ShareResult<ResolveSuccess> => {
    if (env.metrics) {
      const elapsed =
        (typeof performance !== 'undefined' ? performance.now() : nowMs()) -
        startedAt
      env.metrics.count('kranz_tv.share.resolve', { outcome })
      env.metrics.histogram('kranz_tv.share.resolve_ms', elapsed, { outcome })
    }
    return result
  }

  const parsed = ResolvePayloadSchema.safeParse(rawPayload)
  if (!parsed.success) {
    return finish(
      {
        ok: false,
        error: 'invalid_payload',
        message: parsed.error.issues[0]?.message ?? 'Invalid payload',
      },
      'invalid',
    )
  }

  const canonical = normalizeShareId(parsed.data.shareId)

  try {
    const raw = await env.SHARED_CHANNELS_KV.get(`share:${canonical}`)
    if (raw === null) {
      return finish(
        {
          ok: false,
          error: 'not_found',
          message: 'This channel is no longer available.',
        },
        'miss',
      )
    }

    let record: ShareRecord
    try {
      record = JSON.parse(raw) as ShareRecord
    } catch {
      return finish(
        {
          ok: false,
          error: 'kv_unavailable',
          message: 'Stored record is malformed.',
        },
        'kv_error',
      )
    }

    const { credentialHash: _drop, ...publicRecord } = record
    void _drop

    return finish(
      {
        ok: true,
        value: {
          record: publicRecord as PublicShareRecord,
          cacheControl: RESOLVE_CACHE_CONTROL,
        },
      },
      record.revokedAt !== null ? 'revoked' : 'hit',
    )
  } catch (err) {
    return finish(
      {
        ok: false,
        error: 'kv_unavailable',
        message:
          err instanceof Error
            ? `KV read failed: ${err.message}`
            : 'KV read failed',
      },
      'kv_error',
    )
  }
}

// ── revokeShareImpl ─────────────────────────────────────────────────────

interface RevokeSuccess {
  readonly ok: true
  readonly revokedAt: number
}

export async function revokeShareImpl(
  rawPayload: unknown,
  env: ShareEnv,
  nowMs: () => number = Date.now,
): Promise<ShareResult<RevokeSuccess>> {
  const startedAt =
    typeof performance !== 'undefined' ? performance.now() : nowMs()
  const finish = (
    result: ShareResult<RevokeSuccess>,
    outcome: string,
  ): ShareResult<RevokeSuccess> => {
    if (env.metrics) {
      const elapsed =
        (typeof performance !== 'undefined' ? performance.now() : nowMs()) -
        startedAt
      env.metrics.count('kranz_tv.share.revoke', { outcome })
      env.metrics.histogram('kranz_tv.share.revoke_ms', elapsed, { outcome })
    }
    return result
  }

  const parsed = RevokePayloadSchema.safeParse(rawPayload)
  if (!parsed.success) {
    return finish(
      {
        ok: false,
        error: 'invalid_payload',
        message: parsed.error.issues[0]?.message ?? 'Invalid payload',
      },
      'invalid',
    )
  }
  const payload = parsed.data

  try {
    const raw = await env.SHARED_CHANNELS_KV.get(`share:${payload.shareId}`)
    if (raw === null) {
      return finish(
        { ok: false, error: 'not_found', message: 'Share not found.' },
        'not_found',
      )
    }

    let record: ShareRecord
    try {
      record = JSON.parse(raw) as ShareRecord
    } catch {
      return finish(
        {
          ok: false,
          error: 'kv_unavailable',
          message: 'Stored record is malformed.',
        },
        'kv_error',
      )
    }

    const suppliedHash = await sha256Hex(payload.credential)
    if (suppliedHash !== record.credentialHash) {
      return finish(
        {
          ok: false,
          error: 'unauthorized',
          message: 'Only the original sharer can revoke this channel.',
        },
        'unauthorized',
      )
    }

    if (record.revokedAt !== null) {
      // Idempotent re-revoke.
      return finish(
        { ok: true, value: { ok: true, revokedAt: record.revokedAt } },
        'success',
      )
    }

    const revokedAt = nowMs()
    const updated: ShareRecord = { ...record, revokedAt }
    await env.SHARED_CHANNELS_KV.put(
      `share:${payload.shareId}`,
      JSON.stringify(updated),
    )

    return finish({ ok: true, value: { ok: true, revokedAt } }, 'success')
  } catch (err) {
    return finish(
      {
        ok: false,
        error: 'kv_unavailable',
        message:
          err instanceof Error
            ? `KV operation failed: ${err.message}`
            : 'KV operation failed',
      },
      'kv_error',
    )
  }
}

// ── helpers ─────────────────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function getRateLimit(
  kv: KVNamespace,
  credentialHash: string,
): Promise<RateLimitState | null> {
  const raw = await kv.get(`ratelimit:${credentialHash}`)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as RateLimitState
    if (
      typeof parsed.count !== 'number' ||
      typeof parsed.windowStart !== 'number'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

async function bumpRateLimit(
  kv: KVNamespace,
  credentialHash: string,
  current: RateLimitState | null,
  nowMs: number,
): Promise<void> {
  const inWindow =
    current !== null && nowMs - current.windowStart < RATE_LIMIT_WINDOW_MS
  const next: RateLimitState = inWindow
    ? { count: current.count + 1, windowStart: current.windowStart }
    : { count: 1, windowStart: nowMs }
  // TTL: a bit longer than the window so the key self-cleans even if no
  // further publishes happen.
  const ttlSeconds =
    Math.ceil((next.windowStart + RATE_LIMIT_WINDOW_MS - nowMs) / 1000) + 60
  await kv.put(`ratelimit:${credentialHash}`, JSON.stringify(next), {
    expirationTtl: Math.max(ttlSeconds, 60),
  })
}

function trimTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s
}

// Re-exports used by tests and route wrappers
export type { PublishPayload }
