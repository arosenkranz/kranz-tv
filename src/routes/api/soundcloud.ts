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
})

const ScPlaylistSchema = z.object({
  title: z.string(),
  tracks: z.array(z.unknown()),
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
    if (parsed.success) valid.push(parsed.data)
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
    if (!clientId) throw new Error('SOUNDCLOUD_CLIENT_ID not configured')

    const res = await fetch(buildResolveUrl(data.url, clientId), {
      headers: { Accept: 'application/json; charset=utf-8' },
    })

    if (res.status === 404) throw new Error('PLAYLIST_NOT_FOUND')
    if (res.status === 401 || res.status === 403) {
      // Almost always the SOUNDCLOUD_CLIENT_ID secret. SoundCloud has been
      // quietly invalidating legacy client_ids; the public API is closed to
      // new app registrations, so a fresh one can't be minted. Verify the
      // value with `wrangler secret list` and rotate via
      // `wrangler secret put SOUNDCLOUD_CLIENT_ID`.
      throw new Error(
        `SoundCloud API ${res.status} — SOUNDCLOUD_CLIENT_ID is invalid or revoked`,
      )
    }
    if (!res.ok) throw new Error(`SoundCloud API HTTP ${res.status}`)

    const raw: unknown = await res.json()
    return parseSoundCloudPlaylistResponse(raw)
  })

export const Route = createFileRoute('/api/soundcloud')({})
