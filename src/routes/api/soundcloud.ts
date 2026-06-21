import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { isSoundCloudUrl } from '~/lib/sources/soundcloud/parser'

// ---------------------------------------------------------------------------
// SoundCloud API authentication
// ---------------------------------------------------------------------------
//
// As of the 2021 API security update, every request to api.soundcloud.com
// requires an OAuth access token in the Authorization header — the legacy
// "client_id as a query parameter" auth path was retired and returns 401.
//
// We use the Client Credentials grant: exchange { client_id, client_secret }
// for a short-lived access token (~1h), then send it as
//   Authorization: OAuth <access_token>
// on subsequent calls. The token is cached in module scope and refreshed
// on demand. Per SC's rate limits this is a critical optimisation —
// they cap us at 50 token issuances per 12h per app.
//
// Docs:  https://developers.soundcloud.com/docs/api/guide
// Blog:  https://developers.soundcloud.com/blog/security-updates-api/

const SC_API_BASE = 'https://api.soundcloud.com'
const SC_TOKEN_URL = 'https://secure.soundcloud.com/oauth/token'
const MAX_TRACKS = 50

// Refresh the token a minute before it actually expires so an in-flight
// request can't race the expiry boundary.
const TOKEN_EXPIRY_GRACE_MS = 60_000

interface CachedToken {
  accessToken: string
  expiresAtMs: number
}

let tokenCache: CachedToken | null = null
let tokenInFlight: Promise<string> | null = null

const TokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
})

async function fetchAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const credentials = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(SC_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json; charset=utf-8',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    throw new Error(`SoundCloud token endpoint HTTP ${res.status}`)
  }

  const raw: unknown = await res.json()
  const parsed = TokenResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error('SoundCloud token response schema mismatch')
  }

  const { access_token, expires_in } = parsed.data
  tokenCache = {
    accessToken: access_token,
    expiresAtMs: Date.now() + expires_in * 1_000 - TOKEN_EXPIRY_GRACE_MS,
  }
  return access_token
}

async function getAccessToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  if (tokenCache !== null && tokenCache.expiresAtMs > Date.now()) {
    return tokenCache.accessToken
  }
  // Coalesce concurrent refresh attempts so we don't burn token quota
  // (SC limits us to 50 token issuances per 12h per app).
  if (tokenInFlight !== null) return tokenInFlight
  tokenInFlight = fetchAccessToken(clientId, clientSecret).finally(() => {
    tokenInFlight = null
  })
  return tokenInFlight
}

// ---------------------------------------------------------------------------
// SoundCloud playlist response schemas
// ---------------------------------------------------------------------------

const ScUserSchema = z.object({
  username: z.string(),
})

// SC's /resolve endpoint returns partial "stub" objects for tracks beyond the
// first batch — id is always present, but title/duration/permalink_url/user
// may be null or absent. We accept nulls here and filter stubs out below.
const ScTrackSchema = z
  .object({
    id: z.number(),
    title: z.string().nullable().optional(),
    duration: z.number().nullable().optional(),
    permalink_url: z.string().nullable().optional(),
    user: ScUserSchema.nullable().optional(),
    streamable: z.boolean().nullable().optional(),
    policy: z.string().nullable().optional(),
  })
  .passthrough()

const ScPlaylistSchema = z
  .object({
    title: z.string(),
    tracks: z.array(ScTrackSchema),
  })
  .passthrough()

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

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

function buildResolveUrl(playlistUrl: string): string {
  const url = new URL(`${SC_API_BASE}/resolve`)
  url.searchParams.set('url', playlistUrl)
  return url.toString()
}

// ---------------------------------------------------------------------------
// Server function
// ---------------------------------------------------------------------------

export const FetchPlaylistInput = z.object({
  url: z
    .string()
    .url()
    .refine(isSoundCloudUrl, 'url must be an https SoundCloud URL'),
})

export const fetchSoundCloudPlaylist = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => FetchPlaylistInput.parse(data))
  .handler(async ({ data }): Promise<SoundCloudPlaylist> => {
    const clientId = process.env.SOUNDCLOUD_CLIENT_ID
    const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET
    if (!clientId) {
      throw new Error('SOUNDCLOUD_CLIENT_ID not configured')
    }
    if (!clientSecret) {
      throw new Error('SOUNDCLOUD_CLIENT_SECRET not configured')
    }

    const accessToken = await getAccessToken(clientId, clientSecret)

    const resolveUrl = buildResolveUrl(data.url)
    const res = await fetch(resolveUrl, {
      headers: {
        Authorization: `OAuth ${accessToken}`,
        Accept: 'application/json; charset=utf-8',
      },
    })

    // 401 right after a fresh token usually means the cached token went
    // stale at the edge — drop it so the next request re-acquires.
    if (res.status === 401) {
      tokenCache = null
      throw new Error('SoundCloud API HTTP 401')
    }
    if (res.status === 404) {
      throw new Error('PLAYLIST_NOT_FOUND')
    }
    if (!res.ok) {
      throw new Error(`SoundCloud API HTTP ${res.status}`)
    }

    const raw: unknown = await res.json()
    const parseResult = ScPlaylistSchema.safeParse(raw)
    if (!parseResult.success) {
      throw new Error('SoundCloud response schema mismatch')
    }
    const playlist = parseResult.data

    // Preserve playlist order: the SoundCloud widget plays tracks in the
    // playlist's natural order, and the scheduler's skip(N) addresses
    // that same order. Sorting (e.g. by id) would desynchronise the
    // displayed track from what the widget actually plays.
    const allTracks = playlist.tracks

    // SC /resolve may return partial "stub" objects for large playlists —
    // stubs have id but null title/duration/user. Filter these out along with
    // non-streamable tracks (blocked or un-embeddable content).
    const fullTracks = allTracks.filter(
      (t) =>
        t.title &&
        t.duration &&
        t.user &&
        t.permalink_url &&
        t.streamable !== false &&
        t.policy !== 'BLOCK',
    )
    const truncated = fullTracks.slice(0, MAX_TRACKS)

    const tracks: SoundCloudTrack[] = truncated.map((t) => ({
      id: String(t.id),
      title: t.title!,
      artist: t.user!.username,
      durationSeconds: Math.floor(t.duration! / 1000),
      // Use the raw permalink URL here — w.load() accepts it directly, and
      // passing a pre-encoded widget URL causes double-encoding (404s).
      embedUrl: t.permalink_url!,
    }))

    const totalDurationSeconds = tracks.reduce(
      (sum, t) => sum + t.durationSeconds,
      0,
    )

    return { title: playlist.title, tracks, totalDurationSeconds }
  })

export const Route = createFileRoute('/api/soundcloud')({})
