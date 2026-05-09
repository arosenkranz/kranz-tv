// Client-side wrappers around the shares server functions.
//
// Responsibilities:
//   - Resolve the local sharer credential from localStorage on demand
//     (publish/revoke only — resolve is unauthenticated).
//   - Emit RUM events for every flow.
//   - Return a typed `ShareResult` so callers can pattern-match without try/catch.
//
// The actual server-function references are injected via `setShareTransport`
// to avoid pulling server-only code into the client bundle. The defaults
// resolve at runtime from `~/routes/api/shares` (added in T021).

import { getOrCreateCredential } from './share-credential'
import {
  trackSharePublishStarted,
  trackSharePublishCompleted,
  trackSharePublishFailed,
  trackShareResolveStarted,
  trackShareResolveCompleted,
  trackShareResolveFailed,
  trackShareRevokeCompleted,
  trackShareRevokeFailed,
} from '~/lib/datadog/rum'
import type {
  PublicShareRecord,
  ShareErrorCode,
  ShareResult,
} from './share-record'
import type { Channel } from '~/lib/scheduling/types'

// ── Transport ───────────────────────────────────────────────────────────

export interface ShareTransport {
  publish: (input: {
    channel: {
      kind: 'video' | 'music'
      sourceUrl: string
      name: string
      description?: string
    }
    credential: string
  }) => Promise<
    ShareResult<{ shareId: string; shareUrl: string; isNew: boolean }>
  >

  resolve: (input: {
    shareId: string
  }) => Promise<ShareResult<{ record: PublicShareRecord }>>

  revoke: (input: {
    shareId: string
    credential: string
  }) => Promise<ShareResult<{ ok: true; revokedAt: number }>>
}

// Defaults to a transport that throws — the route module replaces this on
// import. This avoids a hard import of route code from non-route consumers.
let transport: ShareTransport = {
  async publish() {
    throw new Error(
      'share-client: transport not configured. Did the route file fail to load?',
    )
  },
  async resolve() {
    throw new Error(
      'share-client: transport not configured. Did the route file fail to load?',
    )
  },
  async revoke() {
    throw new Error(
      'share-client: transport not configured. Did the route file fail to load?',
    )
  },
}

export function setShareTransport(t: ShareTransport): void {
  transport = t
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Publish a custom channel as a share. Reads credential from localStorage.
 * The channel must already exist locally — caller is responsible for
 * passing an importable Channel.
 */
export async function publishShare(
  channel: Channel,
): Promise<ShareResult<{ shareId: string; shareUrl: string; isNew: boolean }>> {
  trackSharePublishStarted()
  try {
    const credential = getOrCreateCredential()
    const sourceUrl =
      channel.kind === 'video'
        ? buildYoutubePlaylistUrl(channel.playlistId)
        : channel.sourceUrl
    const result = await transport.publish({
      channel: {
        kind: channel.kind,
        sourceUrl,
        name: channel.name,
        description: channel.description,
      },
      credential,
    })
    if (result.ok) {
      trackSharePublishCompleted({ isNew: result.value.isNew })
    } else {
      trackSharePublishFailed({ reason: result.error })
    }
    return result
  } catch (err) {
    const reason: ShareErrorCode = 'kv_unavailable'
    trackSharePublishFailed({ reason })
    return {
      ok: false,
      error: reason,
      message:
        err instanceof Error
          ? `Network error: ${err.message}`
          : 'Network error',
    }
  }
}

/**
 * Resolve a share-id to its current `PublicShareRecord`. Unauthenticated.
 * Called once per share URL by the recipient route — the result is then
 * persisted into customChannels for offline use.
 */
export async function resolveShare(
  shareId: string,
): Promise<ShareResult<{ record: PublicShareRecord }>> {
  trackShareResolveStarted()
  try {
    const result = await transport.resolve({ shareId })
    if (result.ok) {
      trackShareResolveCompleted()
    } else {
      trackShareResolveFailed({ reason: result.error })
    }
    return result
  } catch (err) {
    const reason: ShareErrorCode = 'kv_unavailable'
    trackShareResolveFailed({ reason })
    return {
      ok: false,
      error: reason,
      message:
        err instanceof Error
          ? `Network error: ${err.message}`
          : 'Network error',
    }
  }
}

/**
 * Revoke a previously-published share. Reads credential from localStorage.
 * The local credential must match the record's stored credentialHash —
 * otherwise the server returns `unauthorized`.
 */
export async function revokeShare(
  shareId: string,
): Promise<ShareResult<{ ok: true; revokedAt: number }>> {
  try {
    const credential = getOrCreateCredential()
    const result = await transport.revoke({ shareId, credential })
    if (result.ok) {
      trackShareRevokeCompleted()
    } else {
      trackShareRevokeFailed({ reason: result.error })
    }
    return result
  } catch (err) {
    const reason: ShareErrorCode = 'kv_unavailable'
    trackShareRevokeFailed({ reason })
    return {
      ok: false,
      error: reason,
      message:
        err instanceof Error
          ? `Network error: ${err.message}`
          : 'Network error',
    }
  }
}

// ── helpers ─────────────────────────────────────────────────────────────

function buildYoutubePlaylistUrl(playlistId: string): string {
  return `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`
}
