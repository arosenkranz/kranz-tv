import { z } from 'zod'
import type { Channel, VideoChannel } from '~/lib/scheduling/types'
import type { ChannelPreset } from '~/lib/channels/types'
import { extractPlaylistId } from './parser'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'

// ── SoundCloud URL validation ─────────────────────────────────────────────────

const SOUNDCLOUD_ALLOWED_HOSTS = new Set([
  'soundcloud.com',
  'www.soundcloud.com',
  'm.soundcloud.com',
  'on.soundcloud.com',
])

const ALLOWED_SCHEMES = new Set(['https:'])

/**
 * Returns true only for https SoundCloud URLs with an exact-match host.
 * Rejects javascript:, data:, blob:, file:, http:, and subdomain spoofs.
 */
export function isSoundCloudUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return (
      ALLOWED_SCHEMES.has(parsed.protocol) &&
      SOUNDCLOUD_ALLOWED_HOSTS.has(parsed.hostname)
    )
  } catch {
    return false
  }
}

// ── Import form ───────────────────────────────────────────────────────────────

export const ImportFormSchema = z
  .object({
    url: z.string().min(1, 'Playlist URL is required'),
    channelName: z
      .string()
      .min(1, 'Channel name is required')
      .refine((val) => val.trim().length > 0, {
        message: 'Channel name cannot be blank',
      }),
  })
  .refine(
    (data) => extractPlaylistId(data.url) !== null || isSoundCloudUrl(data.url),
    {
      message: 'Could not find a valid YouTube playlist ID or SoundCloud URL',
      path: ['url'],
    },
  )

export type ImportFormData = z.infer<typeof ImportFormSchema>

// ── Channel validation schemas (used by JSON export/import) ───────────────────

const YOUTUBE_THUMBNAIL_HOSTS = ['i.ytimg.com', 'img.youtube.com']

const VideoSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'Invalid YouTube video ID'),
  title: z.string(),
  durationSeconds: z.number().nonnegative(),
  thumbnailUrl: z.string().refine(
    (val) => {
      if (val === '') return true
      try {
        return YOUTUBE_THUMBNAIL_HOSTS.includes(new URL(val).hostname)
      } catch {
        return false
      }
    },
    { message: 'Thumbnail must be a YouTube image URL or empty' },
  ),
})

const VideoChannelSchema = z.object({
  kind: z.literal('video'),
  id: z.string().min(1),
  number: z.number().int().nonnegative(),
  name: z.string().min(1),
  playlistId: z.string().min(1),
  videos: z.array(VideoSchema),
  totalDurationSeconds: z.number().nonnegative(),
  description: z.string().optional(),
})

const TrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string(),
  durationSeconds: z.number().nonnegative(),
  embedUrl: z.string().url(),
})

const MusicChannelSchema = z.object({
  kind: z.literal('music'),
  id: z.string().min(1),
  number: z.number().int().nonnegative(),
  name: z.string().min(1),
  source: z.literal('soundcloud'),
  sourceUrl: z.string().refine(isSoundCloudUrl, {
    message: 'sourceUrl must be a valid https SoundCloud URL',
  }),
  totalDurationSeconds: z.number().nonnegative(),
  trackCount: z.number().int().nonnegative(),
  description: z.string().optional(),
})

export { TrackSchema }

/**
 * Legacy records have no `kind` field — inject `kind: 'video'` so they
 * continue to parse as VideoChannel after the discriminated union migration.
 */
const injectKindPreprocess = (raw: unknown): unknown => {
  if (typeof raw === 'object' && raw !== null && !('kind' in raw)) {
    return { ...(raw as Record<string, unknown>), kind: 'video' }
  }
  return raw
}

const SingleChannelSchema = z.preprocess(
  injectKindPreprocess,
  z.discriminatedUnion('kind', [VideoChannelSchema, MusicChannelSchema]),
)

export const ChannelSchema = SingleChannelSchema

export const ChannelArraySchema = z.array(SingleChannelSchema)

// ── Legacy export schemas ─────────────────────────────────────────────────────

export const ExportEnvelopeSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  channels: ChannelArraySchema,
})

export type ExportEnvelope = z.infer<typeof ExportEnvelopeSchema>

export type ImportResult =
  | { success: true; channel: Channel }
  | { success: false; error: string }

// ── Channel utilities ─────────────────────────────────────────────────────────

/**
 * Adapts a Channel to a ChannelPreset for the guide grid.
 */
export function channelToPreset(channel: Channel): ChannelPreset {
  const common = {
    id: channel.id,
    number: channel.number,
    name: channel.name,
    description: channel.description ?? 'Imported channel',
  }
  if (channel.kind === 'music') {
    return {
      ...common,
      kind: 'music',
      source: 'soundcloud',
      sourceUrl: channel.sourceUrl,
      emoji: '🎵',
    }
  }
  return {
    ...common,
    kind: 'video',
    playlistId: channel.playlistId,
    emoji: '📡',
  }
}

export function isChannelNumberAvailable(
  number: number,
  excludeChannelId: string,
  customChannels: readonly Channel[],
): boolean {
  const presetNumbers = new Set(CHANNEL_PRESETS.map((p) => p.number))
  if (presetNumbers.has(number)) return false
  return !customChannels.some(
    (c) => c.id !== excludeChannelId && c.number === number,
  )
}

export function getNextChannelNumber(
  customChannels: readonly Channel[],
): number {
  const maxPreset = Math.max(...CHANNEL_PRESETS.map((p) => p.number))
  if (customChannels.length === 0) return maxPreset + 1
  const maxCustom = Math.max(...customChannels.map((c) => c.number))
  return Math.max(maxPreset, maxCustom) + 1
}
