import { z } from 'zod'
import type { Channel, Video, ChannelPreset } from './types.ts'
import { seededShuffle, stringToSeed } from '../scheduling/time-utils.ts'
import {
  trackYouTubeApiLatency,
  trackChannelBuildTime,
} from '~/lib/datadog/rum'

// ---------------------------------------------------------------------------
// Zod schemas for YouTube Data API v3 responses
// ---------------------------------------------------------------------------

const YouTubePageInfoSchema = z.object({
  totalResults: z.number(),
  resultsPerPage: z.number(),
})

const YouTubePlaylistItemContentDetailsSchema = z.object({
  videoId: z.string(),
})

const YouTubePlaylistItemSchema = z.object({
  kind: z.literal('youtube#playlistItem'),
  contentDetails: YouTubePlaylistItemContentDetailsSchema,
})

const YouTubePlaylistItemsResponseSchema = z.object({
  kind: z.literal('youtube#playlistItemListResponse'),
  pageInfo: YouTubePageInfoSchema,
  nextPageToken: z.string().optional(),
  items: z.array(YouTubePlaylistItemSchema),
})

const YouTubeThumbnailSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
})

const YouTubeSnippetSchema = z.object({
  title: z.string(),
  thumbnails: z.object({
    default: YouTubeThumbnailSchema.optional(),
    medium: YouTubeThumbnailSchema.optional(),
    high: YouTubeThumbnailSchema.optional(),
    standard: YouTubeThumbnailSchema.optional(),
    maxres: YouTubeThumbnailSchema.optional(),
  }),
})

const YouTubeContentDetailsSchema = z.object({
  duration: z.string(),
})

const YouTubeVideoSchema = z.object({
  kind: z.literal('youtube#video'),
  id: z.string(),
  snippet: YouTubeSnippetSchema,
  contentDetails: YouTubeContentDetailsSchema,
})

const YouTubeVideoListResponseSchema = z.object({
  kind: z.literal('youtube#videoListResponse'),
  pageInfo: YouTubePageInfoSchema,
  items: z.array(YouTubeVideoSchema),
})

// ---------------------------------------------------------------------------
// ISO 8601 duration parser
// ---------------------------------------------------------------------------

/**
 * Parses an ISO 8601 duration string into total seconds.
 *
 * Examples:
 *   PT1H        -> 3600
 *   PT4M13S     -> 253
 *   P1DT2H3M4S  -> 93784
 *
 * Supports weeks (W), days (D), hours (H), minutes (M), seconds (S).
 */
export function parseIsoDuration(duration: string): number {
  const pattern =
    /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/

  const match = pattern.exec(duration)
  if (match === null) {
    throw new Error(`Invalid ISO 8601 duration: "${duration}"`)
  }

  const weeks = parseFloat(match[1] || '0')
  const days = parseFloat(match[2] || '0')
  const hours = parseFloat(match[3] || '0')
  const minutes = parseFloat(match[4] || '0')
  const seconds = parseFloat(match[5] || '0')

  return Math.round(
    weeks * 7 * 86400 + days * 86400 + hours * 3600 + minutes * 60 + seconds,
  )
}

// ---------------------------------------------------------------------------
// Custom error types
// ---------------------------------------------------------------------------

/** Thrown when the YouTube Data API returns a quota exhaustion error (403). */
export class YouTubeQuotaError extends Error {
  constructor() {
    super('YouTube API quota exceeded')
    this.name = 'YouTubeQuotaError'
  }
}

// ---------------------------------------------------------------------------
// Shared response assertion helper
// ---------------------------------------------------------------------------

const QUOTA_ERROR_REASONS = new Set(['quotaExceeded', 'rateLimitExceeded'])

/**
 * Asserts a fetch response is OK. If the response is a 403 with a YouTube
 * quota error reason, throws `YouTubeQuotaError`. Otherwise throws a generic
 * `Error` with the response status and body.
 */
async function assertResponseOk(
  response: Response,
  label: string,
): Promise<void> {
  if (response.ok) return

  if (response.status === 403) {
    try {
      const body = (await response.clone().json()) as {
        error?: { errors?: Array<{ reason?: string }> }
      }
      const reasons = body.error?.errors?.map((e) => e.reason) ?? []
      if (reasons.some((r) => r !== undefined && QUOTA_ERROR_REASONS.has(r))) {
        throw new YouTubeQuotaError()
      }
    } catch (e) {
      if (e instanceof YouTubeQuotaError) throw e
      // JSON parse failed — fall through to generic error below
    }
  }

  throw new Error(`${label} error ${response.status}`)
}

// ---------------------------------------------------------------------------
// Playlist fetching (paginated)
// ---------------------------------------------------------------------------

const PLAYLIST_ITEMS_BASE =
  'https://www.googleapis.com/youtube/v3/playlistItems'
const VIDEO_DETAILS_BASE = 'https://www.googleapis.com/youtube/v3/videos'

/**
 * Fetches all video IDs in a YouTube playlist, following nextPageToken
 * pagination until all pages are consumed.
 */
export async function fetchPlaylistVideoIds(
  playlistId: string,
  apiKey: string,
  maxResults?: number,
): Promise<string[]> {
  const start = performance.now()
  const ids: string[] = []
  let pageToken: string | undefined = undefined

  do {
    const url = new URL(PLAYLIST_ITEMS_BASE)
    url.searchParams.set('part', 'contentDetails')
    url.searchParams.set(
      'maxResults',
      maxResults !== undefined ? String(maxResults) : '50',
    )
    url.searchParams.set('playlistId', playlistId)
    url.searchParams.set('key', apiKey)
    if (pageToken !== undefined) {
      url.searchParams.set('pageToken', pageToken)
    }

    const response = await fetch(url.toString())
    await assertResponseOk(response, 'YouTube playlist API')

    const raw: unknown = await response.json()
    const parsed = YouTubePlaylistItemsResponseSchema.parse(raw)

    for (const item of parsed.items) {
      ids.push(item.contentDetails.videoId)
    }

    pageToken = parsed.nextPageToken
  } while (pageToken !== undefined)

  trackYouTubeApiLatency('playlistItems', performance.now() - start, ids.length)
  return ids
}

// ---------------------------------------------------------------------------
// Video detail fetching
// ---------------------------------------------------------------------------

type SnippetType = z.infer<typeof YouTubeSnippetSchema>

/** Returns the highest-quality available thumbnail URL. */
function selectThumbnailUrl(snippet: SnippetType): string {
  const { thumbnails } = snippet
  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    ''
  )
}

/**
 * Fetches video details (title, duration, thumbnail) for a list of video IDs.
 * Batches requests at 50 IDs per call (YouTube API limit).
 */
export async function fetchVideoDetails(
  videoIds: string[],
  apiKey: string,
): Promise<Video[]> {
  if (videoIds.length === 0) return []

  const start = performance.now()
  const BATCH_SIZE = 50
  const videos: Video[] = []

  for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
    const batch = videoIds.slice(i, i + BATCH_SIZE)

    const url = new URL(VIDEO_DETAILS_BASE)
    url.searchParams.set('part', 'contentDetails,snippet')
    url.searchParams.set('id', batch.join(','))
    url.searchParams.set('key', apiKey)

    const response = await fetch(url.toString())
    await assertResponseOk(response, 'YouTube video API')

    const raw: unknown = await response.json()
    const parsed = YouTubeVideoListResponseSchema.parse(raw)

    for (const item of parsed.items) {
      videos.push({
        id: item.id,
        title: item.snippet.title,
        durationSeconds: parseIsoDuration(item.contentDetails.duration),
        thumbnailUrl: selectThumbnailUrl(item.snippet),
      })
    }
  }

  trackYouTubeApiLatency('videos', performance.now() - start, videos.length)
  return videos
}

// ---------------------------------------------------------------------------
// Channel builder
// ---------------------------------------------------------------------------

/**
 * Fetches all playlist data from the YouTube API and assembles a complete
 * Channel object from the given ChannelPreset. Called at startup.
 */
export async function buildChannel(
  preset: ChannelPreset,
  apiKey: string,
): Promise<Channel> {
  const buildStart = performance.now()

  const videoIds = await fetchPlaylistVideoIds(preset.playlistId, apiKey)
  const unordered = await fetchVideoDetails(videoIds, apiKey)

  // videos.list returns results in an arbitrary order — restore playlist order,
  // then shuffle deterministically by channel ID so similar videos added
  // together are spread across the schedule rather than playing as a block.
  const indexMap = new Map(videoIds.map((id, i) => [id, i]))
  const ordered = [...unordered].sort(
    (a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0),
  )
  const videos = seededShuffle(ordered, stringToSeed(preset.id))

  const totalDurationSeconds = videos.reduce(
    (sum, v) => sum + v.durationSeconds,
    0,
  )

  trackChannelBuildTime(
    preset.id,
    performance.now() - buildStart,
    videos.length,
  )

  return {
    kind: 'video' as const,
    id: preset.id,
    number: preset.number,
    name: preset.name,
    playlistId: preset.playlistId,
    videos,
    totalDurationSeconds,
  }
}
