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
