import { describe, it, expect, beforeEach } from 'vitest'
import { createKvStub } from './kv-stub'
import type { KVStub } from './kv-stub'
import {
  publishShareImpl,
  resolveShareImpl,
  revokeShareImpl,
} from '~/lib/shares/handlers'
import type { KVNamespace, ShareEnv } from '~/lib/shares/handlers'
import type { ShareRecord } from '~/lib/shares/share-record'

// Integration tests for the shares server-function handlers.
// Tests target the pure inner implementations (publishShareImpl, etc.) which
// take an explicit `env` containing the KV binding. The thin createServerFn
// wrapper simply resolves env from the Cloudflare runtime context — covered
// separately by the spike (T020.5) and the manual smoke test (T041).

const VALID_CREDENTIAL = 'A'.repeat(43) // 43 base64url chars
const VALID_YT_URL =
  'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'

function makeEnv(kv?: KVStub): { env: ShareEnv; kv: KVStub } {
  const stub = kv ?? createKvStub()
  return {
    kv: stub,
    env: {
      SHARED_CHANNELS_KV: stub as unknown as KVNamespace,
      origin: 'https://kranz.tv',
    },
  }
}

const validPayload = {
  channel: {
    kind: 'video' as const,
    sourceUrl: VALID_YT_URL,
    name: 'Skate Vids',
    description: 'Mellow skate footage.',
  },
  credential: VALID_CREDENTIAL,
}

describe('publishShareImpl', () => {
  let kv: KVStub
  let env: ShareEnv

  beforeEach(() => {
    const made = makeEnv()
    kv = made.kv
    env = made.env
  })

  describe('success path', () => {
    it('returns ok=true with shareId, shareUrl, and isNew=true', async () => {
      const result = await publishShareImpl(validPayload, env)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.shareId).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/)
      expect(result.value.shareUrl).toBe(
        `https://kranz.tv/s/${result.value.shareId}`,
      )
      expect(result.value.isNew).toBe(true)
    })

    it('writes a record to KV at share:<id>', async () => {
      const result = await publishShareImpl(validPayload, env)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const stored = await kv.get<ShareRecord>(
        `share:${result.value.shareId}`,
        'json',
      )
      expect(stored).not.toBeNull()
      expect(stored!.shareId).toBe(result.value.shareId)
      expect(stored!.kind).toBe('video')
      expect(stored!.name).toBe('Skate Vids')
    })

    it('stores credentialHash but never returns it', async () => {
      const result = await publishShareImpl(validPayload, env)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const stored = await kv.get<ShareRecord>(
        `share:${result.value.shareId}`,
        'json',
      )
      expect(stored!.credentialHash).toMatch(/^[0-9a-f]{64}$/)
      // Returned: hash absent.
      expect(
        (result.value as unknown as Record<string, unknown>).credentialHash,
      ).toBeUndefined()
    })

    it('writes an idempotency entry pointing at the new shareId', async () => {
      const result = await publishShareImpl(validPayload, env)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const snapshot = kv.__snapshot()
      const idempotencyKeys = Object.keys(snapshot).filter((k) =>
        k.startsWith('idempotency:'),
      )
      expect(idempotencyKeys).toHaveLength(1)
      expect(snapshot[idempotencyKeys[0]]).toBe(result.value.shareId)
    })
  })

  describe('idempotency', () => {
    it('returns the SAME shareId on a second publish from the same credential + sourceUrl', async () => {
      const r1 = await publishShareImpl(validPayload, env)
      const r2 = await publishShareImpl(validPayload, env)
      expect(r1.ok && r2.ok).toBe(true)
      if (!r1.ok || !r2.ok) return
      expect(r2.value.shareId).toBe(r1.value.shareId)
      expect(r2.value.isNew).toBe(false)
    })

    it('returns a DIFFERENT shareId for a different credential, same URL', async () => {
      const r1 = await publishShareImpl(validPayload, env)
      const r2 = await publishShareImpl(
        { ...validPayload, credential: 'B'.repeat(43) },
        env,
      )
      expect(r1.ok && r2.ok).toBe(true)
      if (!r1.ok || !r2.ok) return
      expect(r2.value.shareId).not.toBe(r1.value.shareId)
    })

    it('treats trivial URL differences (trailing slash, casing) as the same source', async () => {
      const r1 = await publishShareImpl(validPayload, env)
      const r2 = await publishShareImpl(
        {
          ...validPayload,
          channel: {
            ...validPayload.channel,
            sourceUrl:
              'https://WWW.YouTube.com/playlist/?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
          },
        },
        env,
      )
      expect(r1.ok && r2.ok).toBe(true)
      if (!r1.ok || !r2.ok) return
      expect(r2.value.shareId).toBe(r1.value.shareId)
      expect(r2.value.isNew).toBe(false)
    })
  })

  describe('rate limiting', () => {
    it('rate-limits after 10 publishes per hour for the same credential', async () => {
      // Use 10 distinct sourceUrls so each is a fresh write (no idempotency hit).
      for (let i = 0; i < 10; i++) {
        const result = await publishShareImpl(
          {
            ...validPayload,
            channel: {
              ...validPayload.channel,
              sourceUrl: `https://www.youtube.com/playlist?list=PL${'A'.repeat(
                i + 1,
              )}xxxxxxxxxxxxxxxxxxx`,
            },
          },
          env,
        )
        expect(result.ok).toBe(true)
      }
      const eleventh = await publishShareImpl(
        {
          ...validPayload,
          channel: {
            ...validPayload.channel,
            sourceUrl:
              'https://www.youtube.com/playlist?list=PLZZZZZZZZZZZZZZZZZZZZ',
          },
        },
        env,
      )
      expect(eleventh.ok).toBe(false)
      if (eleventh.ok) return
      expect(eleventh.error).toBe('rate_limited')
      expect(eleventh.retryAfterMs).toBeGreaterThan(0)
      expect(eleventh.retryAfterMs).toBeLessThanOrEqual(3_600_000)
    })

    it('does not rate-limit a different credential', async () => {
      // Saturate credential A.
      for (let i = 0; i < 10; i++) {
        await publishShareImpl(
          {
            ...validPayload,
            channel: {
              ...validPayload.channel,
              sourceUrl: `https://www.youtube.com/playlist?list=PL${'A'.repeat(
                i + 1,
              )}xxxxxxxxxxxxxxxxxxx`,
            },
          },
          env,
        )
      }
      // Credential B is untouched.
      const r = await publishShareImpl(
        { ...validPayload, credential: 'B'.repeat(43) },
        env,
      )
      expect(r.ok).toBe(true)
    })

    it('resets the rate limit after the hour window elapses', async () => {
      // Share a clock between the KV stub and the handler so both observe
      // the same simulated time when we fast-forward past the rate-limit
      // window. KV's TTL eviction and the handler's window check both
      // depend on this clock.
      let simulatedNowMs = Date.now()
      kv.__setNow(() => simulatedNowMs)
      const now = (): number => simulatedNowMs

      for (let i = 0; i < 10; i++) {
        await publishShareImpl(
          {
            ...validPayload,
            channel: {
              ...validPayload.channel,
              sourceUrl: `https://www.youtube.com/playlist?list=PL${'A'.repeat(
                i + 1,
              )}xxxxxxxxxxxxxxxxxxx`,
            },
          },
          env,
          now,
        )
      }
      simulatedNowMs += 60 * 60 * 1000 + 1
      const r = await publishShareImpl(
        {
          ...validPayload,
          channel: {
            ...validPayload.channel,
            sourceUrl:
              'https://www.youtube.com/playlist?list=PLZZZZZZZZZZZZZZZZZZZZ',
          },
        },
        env,
        now,
      )
      expect(r.ok).toBe(true)
    })
  })

  describe('payload validation', () => {
    it('rejects malformed credential', async () => {
      const r = await publishShareImpl(
        { ...validPayload, credential: 'too-short' },
        env,
      )
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.error).toBe('invalid_payload')
    })

    it('rejects empty channel name', async () => {
      const r = await publishShareImpl(
        {
          ...validPayload,
          channel: { ...validPayload.channel, name: '' },
        },
        env,
      )
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.error).toBe('invalid_payload')
    })

    it('rejects non-YouTube sourceUrl when kind=video', async () => {
      const r = await publishShareImpl(
        {
          ...validPayload,
          channel: {
            ...validPayload.channel,
            sourceUrl: 'https://example.com/not-youtube',
          },
        },
        env,
      )
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.error).toBe('invalid_payload')
    })

    it('rejects oversize description', async () => {
      const r = await publishShareImpl(
        {
          ...validPayload,
          channel: { ...validPayload.channel, description: 'x'.repeat(281) },
        },
        env,
      )
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.error).toBe('invalid_payload')
    })
  })

  describe('kv error handling', () => {
    it('surfaces KV failures as kv_unavailable', async () => {
      // Use a stub whose put always throws.
      const failingKv: KVStub = createKvStub()
      const originalPut = failingKv.put.bind(failingKv)
      failingKv.put = async () => {
        // Allow rate-limit + idempotency lookups via get; only puts fail.
        throw new Error('simulated KV outage')
      }
      void originalPut

      const failingEnv: ShareEnv = {
        SHARED_CHANNELS_KV: failingKv as unknown as KVNamespace,
        origin: 'https://kranz.tv',
      }
      const r = await publishShareImpl(validPayload, failingEnv)
      expect(r.ok).toBe(false)
      if (r.ok) return
      expect(r.error).toBe('kv_unavailable')
    })
  })
})

describe('resolveShareImpl', () => {
  let env: ShareEnv
  let publishedShareId: string

  beforeEach(async () => {
    const made = makeEnv()
    env = made.env
    // Seed with a published share via the real handler so we get a valid record.
    const r = await publishShareImpl(validPayload, env)
    if (!r.ok) throw new Error('seed publish failed')
    publishedShareId = r.value.shareId
  })

  it('returns the record when shareId exists', async () => {
    const r = await resolveShareImpl({ shareId: publishedShareId }, env)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.record.shareId).toBe(publishedShareId)
    expect(r.value.record.kind).toBe('video')
    expect(r.value.record.name).toBe('Skate Vids')
  })

  it('does NOT return credentialHash on the resolved record', async () => {
    const r = await resolveShareImpl({ shareId: publishedShareId }, env)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(
      (r.value.record as Record<string, unknown>).credentialHash,
    ).toBeUndefined()
  })

  it('normalizes lowercase shareId before lookup', async () => {
    const r = await resolveShareImpl(
      { shareId: publishedShareId.toLowerCase() },
      env,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.record.shareId).toBe(publishedShareId)
  })

  it('returns not_found for unknown shareId', async () => {
    const r = await resolveShareImpl({ shareId: 'NMATCH12' }, env)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('not_found')
  })

  it('returns the record (NOT an error) when revokedAt is non-null', async () => {
    // Revoke first.
    await revokeShareImpl(
      { shareId: publishedShareId, credential: VALID_CREDENTIAL },
      env,
    )
    const r = await resolveShareImpl({ shareId: publishedShareId }, env)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.record.revokedAt).not.toBeNull()
    // Caller decides what to render; the registry just returns the data.
  })

  it('rejects malformed shareId as invalid_payload', async () => {
    const r = await resolveShareImpl({ shareId: 'too-short' }, env)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('invalid_payload')
  })

  it('exposes a Cache-Control hint for the route layer to apply', async () => {
    const r = await resolveShareImpl({ shareId: publishedShareId }, env)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.cacheControl).toBe(
      'public, max-age=60, stale-while-revalidate=600',
    )
  })

  it('surfaces KV read failures as kv_unavailable', async () => {
    const failingKv = createKvStub()
    failingKv.get = (async () => {
      throw new Error('simulated KV outage')
    }) as KVStub['get']
    const failingEnv: ShareEnv = {
      SHARED_CHANNELS_KV: failingKv as unknown as KVNamespace,
      origin: 'https://kranz.tv',
    }
    const r = await resolveShareImpl({ shareId: 'ABCDEFGH' }, failingEnv)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('kv_unavailable')
  })
})

describe('revokeShareImpl', () => {
  let kv: KVStub
  let env: ShareEnv
  let publishedShareId: string

  beforeEach(async () => {
    const made = makeEnv()
    kv = made.kv
    env = made.env
    const r = await publishShareImpl(validPayload, env)
    if (!r.ok) throw new Error('seed publish failed')
    publishedShareId = r.value.shareId
  })

  it('sets revokedAt and returns ok=true', async () => {
    const r = await revokeShareImpl(
      { shareId: publishedShareId, credential: VALID_CREDENTIAL },
      env,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.revokedAt).toBeGreaterThan(0)
    // Verify the stored record was mutated.
    const stored = (await kv.get(
      `share:${publishedShareId}`,
      'json',
    )) as ShareRecord
    expect(stored.revokedAt).toBe(r.value.revokedAt)
  })

  it('rejects with unauthorized when credential mismatches', async () => {
    const r = await revokeShareImpl(
      { shareId: publishedShareId, credential: 'B'.repeat(43) },
      env,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('unauthorized')
  })

  it('is idempotent — re-revoke returns the existing revokedAt', async () => {
    const r1 = await revokeShareImpl(
      { shareId: publishedShareId, credential: VALID_CREDENTIAL },
      env,
    )
    const r2 = await revokeShareImpl(
      { shareId: publishedShareId, credential: VALID_CREDENTIAL },
      env,
    )
    expect(r1.ok && r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return
    expect(r2.value.revokedAt).toBe(r1.value.revokedAt)
  })

  it('returns not_found for unknown shareId', async () => {
    const r = await revokeShareImpl(
      { shareId: 'NMATCH12', credential: VALID_CREDENTIAL },
      env,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('not_found')
  })

  it('rejects malformed credential', async () => {
    const r = await revokeShareImpl(
      { shareId: publishedShareId, credential: 'short' },
      env,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('invalid_payload')
  })

  it('surfaces KV failures as kv_unavailable', async () => {
    const failingKv = createKvStub()
    failingKv.get = (async () => {
      throw new Error('simulated outage')
    }) as KVStub['get']
    const failingEnv: ShareEnv = {
      SHARED_CHANNELS_KV: failingKv as unknown as KVNamespace,
      origin: 'https://kranz.tv',
    }
    const r = await revokeShareImpl(
      { shareId: 'ABCDEFGH', credential: VALID_CREDENTIAL },
      failingEnv,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('kv_unavailable')
  })
})
