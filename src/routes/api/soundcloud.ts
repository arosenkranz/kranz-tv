import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// SoundCloud API v2 response schemas
// ---------------------------------------------------------------------------
//
// We talk to api-v2.soundcloud.com, the same internal API used by the
// soundcloud.com web client. The legacy v1 API (api.soundcloud.com) was
// closed to new API consumers in 2017 and returns 401 for client_ids that
// were not provisioned with the old developer program. v2 accepts the
// public client_id that SoundCloud exposes in its widget bundle, which is
// what the rest of this app (widget iframe) already uses.
//
// Two-phase fetch:
//   1. /resolve returns the playlist with a `tracks` array. Only the first
//      ~5 tracks come back fully hydrated; the rest are stubs of the form
//      { id, kind: "track", ... } with no title/duration/etc.
//   2. /tracks?ids=A,B,C hydrates a batch of up to 50 tracks in one call.
//
// We send all playlist-track ids (up to MAX_TRACKS) to /tracks and then
// merge results back into playlist order. Tracks that come back missing
// from /tracks (deleted, geo-restricted, private) are dropped.

const ScUserSchema = z.object({
  username: z.string(),
})

// Track stub as returned inside a playlist /resolve response. Only `id`
// is reliably populated; everything else is optional and ignored.
const ScTrackStubSchema = z
  .object({
    id: z.number(),
  })
  .passthrough()

const ScPlaylistSchema = z
  .object({
    title: z.string(),
    tracks: z.array(ScTrackStubSchema),
  })
  .passthrough()

const ScHydratedTrackSchema = z.object({
  id: z.number(),
  title: z.string(),
  duration: z.number(), // milliseconds
  permalink_url: z.string(),
  user: ScUserSchema,
})

const ScHydratedTracksSchema = z.array(ScHydratedTrackSchema)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SC_API_BASE = 'https://api-v2.soundcloud.com'
const MAX_TRACKS = 50 // also the per-request cap on /tracks?ids=

// SC api-v2 occasionally returns 403/406 for fetches without a real UA.
const SC_FETCH_HEADERS = {
  Accept: 'application/json; charset=utf-8',
  'User-Agent':
    'Mozilla/5.0 (compatible; KranzTV/1.0; +https://kranz.tv)',
}

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

function buildResolveUrl(playlistUrl: string, clientId: string): string {
  const url = new URL(`${SC_API_BASE}/resolve`)
  url.searchParams.set('url', playlistUrl)
  url.searchParams.set('client_id', clientId)
  return url.toString()
}

function buildTracksUrl(ids: ReadonlyArray<number>, clientId: string): string {
  const url = new URL(`${SC_API_BASE}/tracks`)
  url.searchParams.set('ids', ids.join(','))
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

    // ---------- Phase 1: resolve playlist ----------
    const resolveUrl = buildResolveUrl(data.url, clientId)
    const resolveStart = Date.now()
    let resolveRes: Response
    try {
      resolveRes = await fetch(resolveUrl, { headers: SC_FETCH_HEADERS })
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
      status: resolveRes.status,
      elapsedMs: Date.now() - resolveStart,
      contentType: resolveRes.headers.get('content-type'),
    })

    if (resolveRes.status === 404) {
      console.error('[SC-DIAG] resolve-404 PLAYLIST_NOT_FOUND', {
        url: data.url,
      })
      throw new Error('PLAYLIST_NOT_FOUND')
    }
    if (!resolveRes.ok) {
      const bodyPreview = await resolveRes.text().catch(() => '<unreadable>')
      console.error('[SC-DIAG] resolve-non-ok', {
        url: data.url,
        status: resolveRes.status,
        bodyPreview: bodyPreview.slice(0, 500),
      })
      throw new Error(`SoundCloud API HTTP ${resolveRes.status}`)
    }

    const rawResolve: unknown = await resolveRes.json().catch((err: unknown) => {
      console.error('[SC-DIAG] resolve-json-parse-failed', {
        url: data.url,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    })
    const resolveParsed = ScPlaylistSchema.safeParse(rawResolve)
    if (!resolveParsed.success) {
      console.error('[SC-DIAG] resolve-schema-parse-failed', {
        url: data.url,
        zodIssues: resolveParsed.error.issues.slice(0, 5),
        rawShape:
          rawResolve && typeof rawResolve === 'object'
            ? Object.keys(rawResolve as Record<string, unknown>).slice(0, 20)
            : typeof rawResolve,
      })
      throw new Error('SoundCloud response schema mismatch')
    }
    const playlist = resolveParsed.data

    // Preserve playlist order — see comment near the schema definitions.
    const orderedIds = playlist.tracks.slice(0, MAX_TRACKS).map((t) => t.id)
    console.log('[SC-DIAG] resolve-parsed', {
      url: data.url,
      title: playlist.title,
      totalTracks: playlist.tracks.length,
      consideredTracks: orderedIds.length,
    })

    if (orderedIds.length === 0) {
      return { title: playlist.title, tracks: [], totalDurationSeconds: 0 }
    }

    // ---------- Phase 2: hydrate tracks ----------
    const tracksUrl = buildTracksUrl(orderedIds, clientId)
    const tracksStart = Date.now()
    let tracksRes: Response
    try {
      tracksRes = await fetch(tracksUrl, { headers: SC_FETCH_HEADERS })
    } catch (err) {
      console.error('[SC-DIAG] tracks-fetch-threw', {
        url: data.url,
        elapsedMs: Date.now() - tracksStart,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
    console.log('[SC-DIAG] tracks-completed', {
      url: data.url,
      status: tracksRes.status,
      elapsedMs: Date.now() - tracksStart,
      contentType: tracksRes.headers.get('content-type'),
    })

    if (!tracksRes.ok) {
      const bodyPreview = await tracksRes.text().catch(() => '<unreadable>')
      console.error('[SC-DIAG] tracks-non-ok', {
        url: data.url,
        status: tracksRes.status,
        bodyPreview: bodyPreview.slice(0, 500),
      })
      throw new Error(`SoundCloud /tracks HTTP ${tracksRes.status}`)
    }

    const rawTracks: unknown = await tracksRes.json().catch((err: unknown) => {
      console.error('[SC-DIAG] tracks-json-parse-failed', {
        url: data.url,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    })
    const tracksParsed = ScHydratedTracksSchema.safeParse(rawTracks)
    if (!tracksParsed.success) {
      console.error('[SC-DIAG] tracks-schema-parse-failed', {
        url: data.url,
        zodIssues: tracksParsed.error.issues.slice(0, 5),
      })
      throw new Error('SoundCloud /tracks response schema mismatch')
    }

    // /tracks returns hydrated tracks in arbitrary order; index by id so we
    // can walk the playlist order and emit a stable result.
    const hydratedById = new Map<number, z.infer<typeof ScHydratedTrackSchema>>(
      tracksParsed.data.map((t) => [t.id, t]),
    )
    const missingIds = orderedIds.filter((id) => !hydratedById.has(id))
    if (missingIds.length > 0) {
      console.warn('[SC-DIAG] tracks-missing-from-hydration', {
        url: data.url,
        missingCount: missingIds.length,
        sampleIds: missingIds.slice(0, 5),
      })
    }

    const tracks: SoundCloudTrack[] = []
    for (const id of orderedIds) {
      const t = hydratedById.get(id)
      if (!t) continue
      tracks.push({
        id: String(t.id),
        title: t.title,
        artist: t.user.username,
        durationSeconds: Math.floor(t.duration / 1000),
        embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(t.permalink_url)}`,
      })
    }

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
      droppedDuringHydration: missingIds.length,
    })

    return { title: playlist.title, tracks, totalDurationSeconds }
  })

export const Route = createFileRoute('/api/soundcloud')({})
