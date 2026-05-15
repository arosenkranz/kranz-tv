import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

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
  const tokenStart = Date.now()
  const res = await fetch(SC_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json; charset=utf-8',
    },
    body: 'grant_type=client_credentials',
  })
  console.log('[SC-DIAG] token-completed', {
    status: res.status,
    elapsedMs: Date.now() - tokenStart,
  })

  if (!res.ok) {
    const bodyPreview = await res.text().catch(() => '<unreadable>')
    console.error('[SC-DIAG] token-non-ok', {
      status: res.status,
      bodyPreview: bodyPreview.slice(0, 500),
    })
    throw new Error(`SoundCloud token endpoint HTTP ${res.status}`)
  }

  const raw: unknown = await res.json()
  const parsed = TokenResponseSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('[SC-DIAG] token-schema-parse-failed', {
      zodIssues: parsed.error.issues.slice(0, 5),
    })
    throw new Error('SoundCloud token response schema mismatch')
  }

  const { access_token, expires_in } = parsed.data
  tokenCache = {
    accessToken: access_token,
    expiresAtMs: Date.now() + expires_in * 1_000 - TOKEN_EXPIRY_GRACE_MS,
  }
  console.log('[SC-DIAG] token-cached', {
    expiresInSeconds: expires_in,
    expiresAtMs: tokenCache.expiresAtMs,
  })
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

const ScTrackSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    duration: z.number(), // milliseconds
    permalink_url: z.string(),
    user: ScUserSchema,
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

const FetchPlaylistInput = z.object({ url: z.string().url() })

export const fetchSoundCloudPlaylist = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => FetchPlaylistInput.parse(data))
  .handler(async ({ data }): Promise<SoundCloudPlaylist> => {
    console.log('[SC-DIAG] handler-called', { url: data.url })

    const clientId = process.env.SOUNDCLOUD_CLIENT_ID
    const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET
    const envKeys = Object.keys(process.env).filter((k) =>
      /SOUNDCLOUD|YOUTUBE|DD_/i.test(k),
    )
    console.log('[SC-DIAG] env-probe', {
      hasClientId: Boolean(clientId),
      clientIdLength: clientId?.length ?? 0,
      hasClientSecret: Boolean(clientSecret),
      clientSecretLength: clientSecret?.length ?? 0,
      relatedEnvKeysPresent: envKeys,
    })
    if (!clientId) {
      console.error('[SC-DIAG] missing-secret SOUNDCLOUD_CLIENT_ID')
      throw new Error('SOUNDCLOUD_CLIENT_ID not configured')
    }
    if (!clientSecret) {
      console.error('[SC-DIAG] missing-secret SOUNDCLOUD_CLIENT_SECRET')
      throw new Error('SOUNDCLOUD_CLIENT_SECRET not configured')
    }

    const accessToken = await getAccessToken(clientId, clientSecret)

    const resolveUrl = buildResolveUrl(data.url)
    const resolveStart = Date.now()
    let res: Response
    try {
      res = await fetch(resolveUrl, {
        headers: {
          Authorization: `OAuth ${accessToken}`,
          Accept: 'application/json; charset=utf-8',
        },
      })
    } catch (err) {
      console.error('[SC-DIAG] resolve-fetch-threw', {
        url: data.url,
        elapsedMs: Date.now() - resolveStart,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
    console.log('[SC-DIAG] resolve-completed', {
      url: data.url,
      status: res.status,
      elapsedMs: Date.now() - resolveStart,
      contentType: res.headers.get('content-type'),
    })

    // 401 right after a fresh token usually means the cached token went
    // stale at the edge — drop it so the next request re-acquires.
    if (res.status === 401) {
      tokenCache = null
      const bodyPreview = await res.text().catch(() => '<unreadable>')
      console.error('[SC-DIAG] resolve-401-dropped-token', {
        url: data.url,
        bodyPreview: bodyPreview.slice(0, 500),
      })
      throw new Error('SoundCloud API HTTP 401')
    }
    if (res.status === 404) {
      console.error('[SC-DIAG] resolve-404 PLAYLIST_NOT_FOUND', {
        url: data.url,
      })
      throw new Error('PLAYLIST_NOT_FOUND')
    }
    if (!res.ok) {
      const bodyPreview = await res.text().catch(() => '<unreadable>')
      console.error('[SC-DIAG] resolve-non-ok', {
        url: data.url,
        status: res.status,
        bodyPreview: bodyPreview.slice(0, 500),
      })
      throw new Error(`SoundCloud API HTTP ${res.status}`)
    }

    const raw: unknown = await res.json().catch((err: unknown) => {
      console.error('[SC-DIAG] resolve-json-parse-failed', {
        url: data.url,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    })
    const parseResult = ScPlaylistSchema.safeParse(raw)
    if (!parseResult.success) {
      console.error('[SC-DIAG] resolve-schema-parse-failed', {
        url: data.url,
        zodIssues: parseResult.error.issues.slice(0, 5),
        rawShape:
          raw && typeof raw === 'object'
            ? Object.keys(raw as Record<string, unknown>).slice(0, 20)
            : typeof raw,
      })
      throw new Error('SoundCloud response schema mismatch')
    }
    const playlist = parseResult.data

    // Preserve playlist order: the SoundCloud widget plays tracks in the
    // playlist's natural order, and the scheduler's skip(N) addresses
    // that same order. Sorting (e.g. by id) would desynchronise the
    // displayed track from what the widget actually plays.
    const truncated = playlist.tracks.slice(0, MAX_TRACKS)

    const tracks: SoundCloudTrack[] = truncated.map((t) => ({
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

    console.log('[SC-DIAG] success', {
      url: data.url,
      title: playlist.title,
      trackCount: tracks.length,
      totalDurationSeconds,
      truncatedFrom: playlist.tracks.length,
    })

    return { title: playlist.title, tracks, totalDurationSeconds }
  })

export const Route = createFileRoute('/api/soundcloud')({})
