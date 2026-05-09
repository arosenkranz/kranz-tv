// MUST NOT be statically prerendered — calls resolveShare() at request time,
// which reads Cloudflare KV. Prerendering would 404 every share URL.
//
// This route is the entry point for share recipients. The flow:
//   1. Validate the shareId from the URL
//   2. Check if we already have a local channel with this shareId (idempotent
//      receive — covers "user opens the same /s/<id> twice")
//   3. Otherwise, call resolveShare() to fetch the share record
//   4. Build a real Channel via importChannel() (client-side YouTube/SoundCloud
//      fetch — constitution Principle II)
//   5. Persist with shareRef.role='recipient'
//   6. Redirect to the canonical /channel/<id> route
//
// All async work runs in useEffect because importChannel needs the browser's
// VITE_YOUTUBE_API_KEY which isn't available during SSR.

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { resolveShare } from '~/lib/shares/share-client'
import {
  findChannelByShareId,
  loadCustomChannels,
  saveCustomChannels,
} from '~/lib/storage/local-channels'
import { isValidShareId, normalizeShareId } from '~/lib/shares/share-id'
import { importChannel } from '~/lib/import/import-channel'
import { getNextChannelNumber } from '~/lib/import/schema'
import type {
  PublicShareRecord,
  ShareErrorCode,
} from '~/lib/shares/share-record'
import type { Channel } from '~/lib/scheduling/types'

const MONO = "'VT323', 'Courier New', monospace"
const GREEN = '#39ff14'

// User-facing copy for each error path.
const ERROR_COPY: Record<ShareErrorCode | 'revoked' | 'import_failed', string> =
  {
    not_found: 'This channel is no longer available.',
    revoked: 'This channel is no longer available.',
    invalid_payload: 'This link is invalid.',
    kv_unavailable: "Couldn't load shared channel — try again.",
    rate_limited: "Couldn't load shared channel — try again.",
    unauthorized: 'This link is invalid.',
    import_failed:
      "Found the share, but couldn't load its videos. The original playlist may be private or removed.",
  }

type ReceiveStatus =
  | { phase: 'pending' }
  | { phase: 'error'; key: keyof typeof ERROR_COPY; canRetry: boolean }

function shareIdToChannelId(shareId: string): string {
  return `share-${normalizeShareId(shareId)}`
}

export const Route = createFileRoute('/s/$shareId')({
  component: ShareReceiver,
})

export function ShareReceiver() {
  const { shareId: rawShareId } = Route.useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<ReceiveStatus>({ phase: 'pending' })
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function run(): Promise<void> {
      // 1. Validate format up front.
      const canonical = normalizeShareId(rawShareId)
      if (!isValidShareId(canonical)) {
        if (!cancelled)
          setStatus({ phase: 'error', key: 'invalid_payload', canRetry: false })
        return
      }

      // 2. Idempotent receive — skip work if we already have this share locally.
      const existing = findChannelByShareId(canonical)
      if (existing !== undefined) {
        await navigate({
          to: '/channel/$channelId',
          params: { channelId: existing.id },
          replace: true,
        })
        return
      }

      // 3. Fetch the share record from the registry.
      const resolveResult = await resolveShare(canonical)
      if (cancelled) return
      if (!resolveResult.ok) {
        const canRetry =
          resolveResult.error === 'kv_unavailable' ||
          resolveResult.error === 'rate_limited'
        setStatus({ phase: 'error', key: resolveResult.error, canRetry })
        return
      }

      const record = resolveResult.value.record
      if (record.revokedAt !== null) {
        setStatus({ phase: 'error', key: 'revoked', canRetry: false })
        return
      }

      // 4. Build a real Channel by calling YouTube/SoundCloud (client-side).
      const channel = await buildChannelFromRecord(record)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `cancelled` may flip during the YouTube fetch above; the linter loses track across awaits.
      if (cancelled) return
      if (channel === null) {
        setStatus({ phase: 'error', key: 'import_failed', canRetry: true })
        return
      }

      // 5. Persist with shareRef.role='recipient'. We re-load existing
      //    channels first to avoid trampling other recipient writes that
      //    may have happened concurrently in another tab.
      const existingNow = loadCustomChannels()
      const channelWithRef: Channel = {
        ...channel,
        shareRef: { shareId: canonical, role: 'recipient' },
      }
      saveCustomChannels([...existingNow, channelWithRef])

      // 6. Redirect to canonical channel route.
      await navigate({
        to: '/channel/$channelId',
        params: { channelId: channel.id },
        replace: true,
      })
    }

    void run()
    return () => {
      cancelled = true
    }
    // retryToken intentional — bumping it re-runs the effect.
  }, [rawShareId, navigate, retryToken])

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#000',
        color: GREEN,
        fontFamily: MONO,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      {status.phase === 'pending' && (
        <p
          style={{
            fontSize: '2rem',
            letterSpacing: '0.15em',
            textShadow: `0 0 8px ${GREEN}`,
          }}
        >
          TUNING IN<span aria-hidden="true">…</span>
        </p>
      )}

      {status.phase === 'error' && (
        <div
          style={{
            maxWidth: '32rem',
            textAlign: 'center',
            border: `1px solid rgba(57,255,20,0.4)`,
            padding: '2rem 2rem 1.5rem',
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
        >
          <p
            style={{
              fontSize: '1.4rem',
              letterSpacing: '0.1em',
              margin: 0,
              marginBottom: '1rem',
            }}
          >
            {ERROR_COPY[status.key]}
          </p>
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              marginTop: '1rem',
              flexWrap: 'wrap',
            }}
          >
            {status.canRetry && (
              <button
                type="button"
                onClick={() => setRetryToken((n) => n + 1)}
                style={shareErrorButtonStyle()}
              >
                RETRY
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void navigate({ to: '/', replace: true })
              }}
              style={shareErrorButtonStyle()}
            >
              BACK TO HOME
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── helpers ─────────────────────────────────────────────────────────────

async function buildChannelFromRecord(
  record: PublicShareRecord,
): Promise<Channel | null> {
  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY ?? ''
  const customChannels = loadCustomChannels()
  const nextNumber = getNextChannelNumber(customChannels)

  const result = await importChannel(
    record.sourceUrl,
    record.name,
    nextNumber,
    apiKey,
  )
  if (!result.success) return null

  // Override the slugified ID with our deterministic share-based ID so
  // future visits to /s/<id> are idempotent and the channel is stable
  // across reloads.
  const stableId = shareIdToChannelId(record.shareId)
  const channel = result.channel
  if (channel.kind === 'video') {
    return {
      ...channel,
      id: stableId,
      description: record.description ?? undefined,
    }
  }
  return {
    ...channel,
    id: stableId,
    description: record.description ?? undefined,
  }
}

function shareErrorButtonStyle(): React.CSSProperties {
  return {
    backgroundColor: 'transparent',
    color: GREEN,
    border: `1px solid ${GREEN}`,
    padding: '0.5rem 1.25rem',
    fontFamily: MONO,
    fontSize: '1.1rem',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  }
}
