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
// track that is private, geo-blocked, or otherwise inaccessible. Treating
// the full shape as optional lets a playlist still load when a handful of
// tracks come back as placeholders — we filter the partials out below.
const ScTrackSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  duration: z.number().optional(), // milliseconds
  permalink_url: z.string().optional(),
  user: ScUserSchema.optional(),
})

const ScPlaylistSchema = z.object({
  title: z.string(),
  tracks: z.array(ScTrackSchema),
})

type ScTrack = z.infer<typeof ScTrackSchema>
type ScTrackFull = ScTrack & {
  title: string
  duration: number
  permalink_url: string
  user: { username: string }
}

function isFullTrack(t: ScTrack): t is ScTrackFull {
  return (
    typeof t.title === 'string' &&
    typeof t.duration === 'number' &&
    typeof t.permalink_url === 'string' &&
    t.user !== undefined &&
    typeof t.user.username === 'string'
  )
}

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

  // Drop placeholder tracks before truncating so we keep as many playable
  // tracks as possible. Sort by track id for deterministic ordering —
  // preserves schedule stability if the playlist is re-imported later.
  const sorted = playlist.tracks
    .filter(isFullTrack)
    .slice(0, MAX_TRACKS)
    .sort((a, b) => a.id - b.id)

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
    if (!clientId) throw new Error('SOUNDCLOUD_CLIENT_ID not configured')

    const res = await fetch(buildResolveUrl(data.url, clientId), {
      headers: { Accept: 'application/json; charset=utf-8' },
    })

    if (res.status === 404) throw new Error('PLAYLIST_NOT_FOUND')
    if (!res.ok) throw new Error(`SoundCloud API HTTP ${res.status}`)

    const raw: unknown = await res.json()
    return parseSoundCloudPlaylistResponse(raw)
  })

export const Route = createFileRoute('/api/soundcloud')({})
