import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// SoundCloud API response schemas
// ---------------------------------------------------------------------------

const ScUserSchema = z.object({
  username: z.string(),
})

const ScTrackSchema = z.object({
  id: z.number(),
  title: z.string(),
  duration: z.number(), // milliseconds
  permalink_url: z.string(),
  user: ScUserSchema,
})

const ScPlaylistSchema = z.object({
  title: z.string(),
  tracks: z.array(ScTrackSchema),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SC_API_BASE = 'https://api.soundcloud.com'
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

// SoundCloud playlist URLs look like: soundcloud.com/artist/sets/playlist-name
// The REST API accepts the URL directly via the /resolve endpoint.
function buildResolveUrl(playlistUrl: string, clientId: string): string {
  const url = new URL(`${SC_API_BASE}/resolve`)
  url.searchParams.set('url', playlistUrl)
  url.searchParams.set('client_id', clientId)
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
    const envKeys = Object.keys(process.env).filter((k) =>
      /SOUNDCLOUD|YOUTUBE|DD_/i.test(k),
    )
    console.log('[SC-DIAG] env-probe', {
      hasSoundcloudClientId: Boolean(clientId),
      soundcloudClientIdLength: clientId?.length ?? 0,
      relatedEnvKeysPresent: envKeys,
    })
    if (!clientId) {
      console.error('[SC-DIAG] missing-secret SOUNDCLOUD_CLIENT_ID', {
        url: data.url,
      })
      throw new Error('SOUNDCLOUD_CLIENT_ID not configured')
    }

    const resolveUrl = buildResolveUrl(data.url, clientId)
    const fetchStart = Date.now()
    let res: Response
    try {
      res = await fetch(resolveUrl, {
        headers: { Accept: 'application/json; charset=utf-8' },
      })
    } catch (err) {
      console.error('[SC-DIAG] fetch-threw', {
        url: data.url,
        elapsedMs: Date.now() - fetchStart,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
    console.log('[SC-DIAG] fetch-completed', {
      url: data.url,
      status: res.status,
      elapsedMs: Date.now() - fetchStart,
      contentType: res.headers.get('content-type'),
    })

    if (res.status === 404) {
      console.error('[SC-DIAG] http-404 PLAYLIST_NOT_FOUND', { url: data.url })
      throw new Error('PLAYLIST_NOT_FOUND')
    }
    if (!res.ok) {
      const bodyPreview = await res.text().catch(() => '<unreadable>')
      console.error('[SC-DIAG] http-non-ok', {
        url: data.url,
        status: res.status,
        bodyPreview: bodyPreview.slice(0, 500),
      })
      throw new Error(`SoundCloud API HTTP ${res.status}`)
    }

    const raw: unknown = await res.json().catch((err: unknown) => {
      console.error('[SC-DIAG] json-parse-failed', {
        url: data.url,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    })
    const parseResult = ScPlaylistSchema.safeParse(raw)
    if (!parseResult.success) {
      console.error('[SC-DIAG] schema-parse-failed', {
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
    // playlist's natural order, and the scheduler's skip(N) addresses that
    // same order. Sorting (e.g. by id) would desynchronise the displayed
    // track from what the widget actually plays.
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
