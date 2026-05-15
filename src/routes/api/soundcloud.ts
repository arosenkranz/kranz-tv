import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// SoundCloud API response schemas
// ---------------------------------------------------------------------------

const ScUserSchema = z.object({
  username: z.string(),
})

// SoundCloud's /resolve endpoint returns the full track object for tracks
// the requester can see, but a placeholder `{ id, kind: 'track' }` for any
// track that is private, geo-blocked, or otherwise inaccessible. Each track
// is validated individually with safeParse below — placeholders and any
// other malformed entries (null fields, wrong types) are silently dropped
// so a few bad tracks don't take down the whole channel.
const ScTrackSchema = z.object({
  id: z.number(),
  title: z.string(),
  duration: z.number(), // milliseconds
  permalink_url: z.string(),
  user: ScUserSchema,
  // Embed/play eligibility — present on most /resolve responses.
  // We treat absent fields as permissive (assume embeddable).
  embeddable_by: z.enum(['all', 'me', 'none']).optional(),
  policy: z.enum(['ALLOW', 'MONETIZE', 'SNIP', 'BLOCK']).optional(),
  sharing: z.enum(['public', 'private']).optional(),
})

function isPlayableInWidget(t: z.infer<typeof ScTrackSchema>): boolean {
  // The widget silently skips tracks it can't play. If our `tracks[]` keeps
  // them, `skip(trackIndex)` lands on the wrong song and the live schedule
  // desyncs from what's actually audible. Drop them at the boundary so our
  // index and the widget's stay aligned.
  if (t.embeddable_by !== undefined && t.embeddable_by !== 'all') return false
  if (t.policy === 'BLOCK') return false
  if (t.sharing === 'private') return false
  return true
}

const ScPlaylistSchema = z.object({
  title: z.string(),
  tracks: z.array(z.unknown()),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SC_API_BASE = 'https://api.soundcloud.com'
const SC_TOKEN_URL = `${SC_API_BASE}/oauth2/token`
const MAX_TRACKS = 50

export interface SoundCloudTrack {
  id: string
  title: string
  artist: string
  durationSeconds: number
  embedUrl: string
}

export interface SoundCloudPlaylist {
  title: string
  tracks: SoundCloudTrack[]
  totalDurationSeconds: number
}

// ---------------------------------------------------------------------------
// OAuth client_credentials token (cached per worker isolate)
// ---------------------------------------------------------------------------
//
// SoundCloud's /resolve endpoint stopped accepting `?client_id=X` for most
// callers — it now requires an OAuth bearer token minted via the
// client_credentials grant. Tokens are valid for ~1 hour; we cache at the
// module level (lives for the life of the worker isolate) and refresh
// 60s before expiry so request paths never wait for a token round-trip
// on the bleeding edge.

let cachedToken: { value: string; expiresAtMs: number } | null = null

const TokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
})

async function getAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const now = Date.now()
  if (cachedToken && now < cachedToken.expiresAtMs - 60_000) {
    return cachedToken.value
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(SC_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json; charset=utf-8',
    },
    body,
  })

  if (res.status === 401 || res.status === 403) {
    cachedToken = null
    throw new Error(
      `SoundCloud token endpoint ${res.status} — SOUNDCLOUD_CLIENT_ID or SOUNDCLOUD_CLIENT_SECRET is invalid`,
    )
  }
  if (!res.ok) {
    throw new Error(`SoundCloud token endpoint HTTP ${res.status}`)
  }

  const parsed = TokenResponseSchema.parse(await res.json())
  cachedToken = {
    value: parsed.access_token,
    expiresAtMs: now + parsed.expires_in * 1000,
  }
  return parsed.access_token
}

/**
 * Parses a raw SoundCloud `/resolve` playlist response into our
 * `SoundCloudPlaylist` shape. Placeholder tracks (private, deleted,
 * geo-blocked) come back with only `{ id }` populated — we tolerate them
 * in the schema and filter them out here so the playlist still loads.
 *
 * Exported for unit testing.
 */
export function parseSoundCloudPlaylistResponse(raw: unknown): SoundCloudPlaylist {
  const playlist = ScPlaylistSchema.parse(raw)

  // Validate each track individually — anything that doesn't match the
  // full schema (placeholders, null fields, wrong types) is silently
  // dropped so the rest of the playlist still loads. Sort by id for
  // deterministic schedule ordering.
  const valid: z.infer<typeof ScTrackSchema>[] = []
  for (const rawTrack of playlist.tracks) {
    const parsed = ScTrackSchema.safeParse(rawTrack)
    if (parsed.success && isPlayableInWidget(parsed.data)) {
      valid.push(parsed.data)
    }
  }

  const sorted = valid.slice(0, MAX_TRACKS).sort((a, b) => a.id - b.id)

  const tracks: SoundCloudTrack[] = sorted.map((t) => ({
    id: String(t.id),
    title: t.title,
    artist: t.user.username,
    durationSeconds: Math.floor(t.duration / 1000),
    embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(t.permalink_url)}`,
  }))

  const totalDurationSeconds = tracks.reduce(
    (sum, t) => sum + t.durationSeconds,
    0,
  )

  return { title: playlist.title, tracks, totalDurationSeconds }
}

// ---------------------------------------------------------------------------
// Server function
// ---------------------------------------------------------------------------

const FetchPlaylistInput = z.object({ url: z.string().url() })

export const fetchSoundCloudPlaylist = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => FetchPlaylistInput.parse(data))
  .handler(async ({ data }): Promise<SoundCloudPlaylist> => {
    const clientId = process.env.SOUNDCLOUD_CLIENT_ID
    const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET
    if (!clientId) throw new Error('SOUNDCLOUD_CLIENT_ID not configured')
    if (!clientSecret) throw new Error('SOUNDCLOUD_CLIENT_SECRET not configured')

    const accessToken = await getAccessToken(clientId, clientSecret)

    const resolveUrl = new URL(`${SC_API_BASE}/resolve`)
    resolveUrl.searchParams.set('url', data.url)

    const doFetch = (token: string): Promise<Response> =>
      fetch(resolveUrl.toString(), {
        headers: {
          Accept: 'application/json; charset=utf-8',
          Authorization: `OAuth ${token}`,
        },
      })

    let res = await doFetch(accessToken)

    // If the cached token has been revoked server-side, invalidate and retry once.
    if (res.status === 401) {
      cachedToken = null
      const fresh = await getAccessToken(clientId, clientSecret)
      res = await doFetch(fresh)
    }

    if (res.status === 404) throw new Error('PLAYLIST_NOT_FOUND')
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `SoundCloud API ${res.status} — SOUNDCLOUD_CLIENT_ID / SOUNDCLOUD_CLIENT_SECRET rejected`,
      )
    }
    if (!res.ok) throw new Error(`SoundCloud API HTTP ${res.status}`)

    const raw: unknown = await res.json()
    return parseSoundCloudPlaylistResponse(raw)
  })

export const Route = createFileRoute('/api/soundcloud')({})
