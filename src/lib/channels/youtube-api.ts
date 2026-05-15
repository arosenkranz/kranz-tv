import type { Channel, Video, ChannelPreset } from './types.ts'
import { seededShuffle, stringToSeed } from '../scheduling/time-utils.ts'
import { trackChannelBuildTime } from '~/lib/datadog/rum'
import { fetchYouTubePlaylist } from '~/routes/api/youtube'
import { fetchSoundCloudPlaylist } from '~/routes/api/soundcloud'

// ---------------------------------------------------------------------------
// ISO 8601 duration parser — kept here because it's tested directly
// ---------------------------------------------------------------------------

export function parseIsoDuration(duration: string): number {
  const pattern =
    /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
  const match = pattern.exec(duration)
  if (match === null) throw new Error(`Invalid ISO 8601 duration: "${duration}"`)
  const weeks = parseFloat(match[1] || '0')
  const days = parseFloat(match[2] || '0')
  const hours = parseFloat(match[3] || '0')
  const minutes = parseFloat(match[4] || '0')
  const seconds = parseFloat(match[5] || '0')
  return Math.round(weeks * 604800 + days * 86400 + hours * 3600 + minutes * 60 + seconds)
}

// ---------------------------------------------------------------------------
// Error types — kept here because call sites import and instanceof-check them
// ---------------------------------------------------------------------------

export class YouTubeQuotaError extends Error {
  constructor() {
    super('YouTube API quota exceeded')
    this.name = 'YouTubeQuotaError'
  }
}

// ---------------------------------------------------------------------------
// Channel builder — delegates API calls to server functions
// ---------------------------------------------------------------------------

export async function buildChannel(preset: ChannelPreset): Promise<Channel> {
  if (preset.kind === 'music') {
    const playlist = await fetchSoundCloudPlaylist({ data: { url: preset.sourceUrl } })
    return {
      kind: 'music',
      id: preset.id,
      number: preset.number,
      name: preset.name,
      source: 'soundcloud',
      sourceUrl: preset.sourceUrl,
      totalDurationSeconds: playlist.totalDurationSeconds,
      trackCount: playlist.tracks.length,
      tracks: playlist.tracks,
    }
  }

  const buildStart = performance.now()

  let videos: Video[]
  try {
    const fetched = await fetchYouTubePlaylist({ data: { playlistId: preset.playlistId } })
    // Server fn returns videos in playlist order; shuffle deterministically by
    // channel ID so similar videos added together spread across the schedule.
    videos = seededShuffle(
      fetched.map((v): Video => ({
        id: v.id,
        title: v.title,
        durationSeconds: v.durationSeconds,
        thumbnailUrl: v.thumbnailUrl,
      })),
      stringToSeed(preset.id),
    )
  } catch (e) {
    if (e instanceof Error && e.message === 'QUOTA_EXCEEDED') {
      throw new YouTubeQuotaError()
    }
    throw e
  }

  const totalDurationSeconds = videos.reduce((sum, v) => sum + v.durationSeconds, 0)
  trackChannelBuildTime(preset.id, performance.now() - buildStart, videos.length)

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
