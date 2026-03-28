import { z } from 'zod'
import type { Channel } from '~/lib/scheduling/types'
import type { ChannelPreset } from '~/lib/channels/types'
import { extractPlaylistId } from './parser'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'

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
  .refine((data) => extractPlaylistId(data.url) !== null, {
    message: 'Could not find a valid YouTube playlist ID in that URL',
    path: ['url'],
  })

export type ImportFormData = z.infer<typeof ImportFormSchema>

// ── Channel validation schemas (used by JSON export/import) ─────────────────

const YOUTUBE_THUMBNAIL_HOSTS = ['i.ytimg.com', 'img.youtube.com']

const VideoSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'Invalid YouTube video ID'),
  title: z.string(),
  durationSeconds: z.number().nonnegative(),
  thumbnailUrl: z
    .string()
    .refine(
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

export const ChannelSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().nonnegative(),
  name: z.string().min(1),
  playlistId: z.string().min(1),
  videos: z.array(VideoSchema),
  totalDurationSeconds: z.number().nonnegative(),
})

export const ChannelArraySchema = z.array(ChannelSchema)

export const ExportEnvelopeSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  channels: ChannelArraySchema,
})

export type ExportEnvelope = z.infer<typeof ExportEnvelopeSchema>

export type ImportResult =
  | { success: true; channel: Channel }
  | { success: false; error: string }

/** Adapts a custom Channel to a ChannelPreset so it works in the guide grid. */
export function channelToPreset(channel: Channel): ChannelPreset {
  return {
    id: channel.id,
    number: channel.number,
    name: channel.name,
    description: 'Imported channel',
    playlistId: channel.playlistId,
    emoji: '📡',
  }
}

/**
 * Returns the next available channel number after all presets and existing custom channels.
 */
export function getNextChannelNumber(
  customChannels: readonly Channel[],
): number {
  const maxPreset = Math.max(...CHANNEL_PRESETS.map((p) => p.number))
  if (customChannels.length === 0) return maxPreset + 1
  const maxCustom = Math.max(...customChannels.map((c) => c.number))
  return Math.max(maxPreset, maxCustom) + 1
}
