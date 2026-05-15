import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const PageInfoSchema = z.object({
  totalResults: z.number(),
  resultsPerPage: z.number(),
})

const PlaylistItemSchema = z.object({
  kind: z.literal('youtube#playlistItem'),
  contentDetails: z.object({ videoId: z.string() }),
})

const PlaylistItemsResponseSchema = z.object({
  kind: z.literal('youtube#playlistItemListResponse'),
  pageInfo: PageInfoSchema,
  nextPageToken: z.string().optional(),
  items: z.array(PlaylistItemSchema),
})

const ThumbnailSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
})

const VideoSchema = z.object({
  kind: z.literal('youtube#video'),
  id: z.string(),
  snippet: z.object({
    title: z.string(),
    thumbnails: z.object({
      default: ThumbnailSchema.optional(),
      medium: ThumbnailSchema.optional(),
      high: ThumbnailSchema.optional(),
      standard: ThumbnailSchema.optional(),
      maxres: ThumbnailSchema.optional(),
    }),
  }),
  contentDetails: z.object({ duration: z.string() }),
})

const VideoListResponseSchema = z.object({
  kind: z.literal('youtube#videoListResponse'),
  pageInfo: PageInfoSchema,
  items: z.array(VideoSchema),
})

const QUOTA_REASONS = new Set(['quotaExceeded', 'rateLimitExceeded'])
const PLAYLIST_ITEMS_BASE = 'https://www.googleapis.com/youtube/v3/playlistItems'
const VIDEO_DETAILS_BASE = 'https://www.googleapis.com/youtube/v3/videos'

async function assertOk(response: Response, label: string): Promise<void> {
  if (response.ok) return
  if (response.status === 403) {
    try {
      const body = (await response.clone().json()) as {
        error?: { errors?: Array<{ reason?: string }> }
      }
      const reasons = body.error?.errors?.map((e) => e.reason) ?? []
      if (reasons.some((r) => r !== undefined && QUOTA_REASONS.has(r))) {
        throw new Error('QUOTA_EXCEEDED')
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'QUOTA_EXCEEDED') throw e
    }
  }
  throw new Error(`${label} HTTP ${response.status}`)
}

function parseIsoDuration(duration: string): number {
  const pattern =
    /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  const match = pattern.exec(duration)
  if (!match) throw new Error(`Invalid ISO 8601 duration: "${duration}"`)
  const w = parseFloat(match[1] || '0')
  const d = parseFloat(match[2] || '0')
  const h = parseFloat(match[3] || '0')
  const m = parseFloat(match[4] || '0')
  const s = parseFloat(match[5] || '0')
  return Math.round(w * 604800 + d * 86400 + h * 3600 + m * 60 + s)
}

type Thumbnails = z.infer<typeof VideoSchema>['snippet']['thumbnails']
function selectThumbnail(thumbnails: Thumbnails): string {
  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    ''
  )
}

export interface YoutubeVideo {
  id: string
  title: string
  durationSeconds: number
  thumbnailUrl: string
}

const FetchPlaylistInput = z.object({ playlistId: z.string().min(1) })

export const fetchYouTubePlaylist = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => FetchPlaylistInput.parse(data))
  .handler(async ({ data }): Promise<YoutubeVideo[]> => {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) throw new Error('YOUTUBE_API_KEY not configured')

    const ids: string[] = []
    let pageToken: string | undefined

    do {
      const url = new URL(PLAYLIST_ITEMS_BASE)
      url.searchParams.set('part', 'contentDetails')
      url.searchParams.set('maxResults', '50')
      url.searchParams.set('playlistId', data.playlistId)
      url.searchParams.set('key', apiKey)
      if (pageToken) url.searchParams.set('pageToken', pageToken)

      const res = await fetch(url.toString())
      await assertOk(res, 'YouTube playlistItems')
      const parsed = PlaylistItemsResponseSchema.parse(await res.json())
      for (const item of parsed.items) ids.push(item.contentDetails.videoId)
      pageToken = parsed.nextPageToken
    } while (pageToken)

    if (ids.length === 0) return []

    const videos: YoutubeVideo[] = []
    const BATCH = 50

    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH)
      const url = new URL(VIDEO_DETAILS_BASE)
      url.searchParams.set('part', 'contentDetails,snippet')
      url.searchParams.set('id', batch.join(','))
      url.searchParams.set('key', apiKey)

      const res = await fetch(url.toString())
      await assertOk(res, 'YouTube videos')
      const parsed = VideoListResponseSchema.parse(await res.json())

      for (const item of parsed.items) {
        videos.push({
          id: item.id,
          title: item.snippet.title,
          durationSeconds: parseIsoDuration(item.contentDetails.duration),
          thumbnailUrl: selectThumbnail(item.snippet.thumbnails),
        })
      }
    }

    const indexMap = new Map(ids.map((id, i) => [id, i]))
    return [...videos].sort(
      (a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0),
    )
  })

const CheckQuotaInput = z.object({ playlistId: z.string().min(1) })

export const checkYouTubeQuota = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => CheckQuotaInput.parse(data))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) return { ok: false }

    const url = new URL(PLAYLIST_ITEMS_BASE)
    url.searchParams.set('part', 'contentDetails')
    url.searchParams.set('maxResults', '1')
    url.searchParams.set('playlistId', data.playlistId)
    url.searchParams.set('key', apiKey)

    try {
      const res = await fetch(url.toString())
      await assertOk(res, 'YouTube quota check')
      return { ok: true }
    } catch (e) {
      if (e instanceof Error && e.message === 'QUOTA_EXCEEDED') {
        return { ok: false }
      }
      throw e
    }
  })

export const Route = createFileRoute('/api/youtube')({})
