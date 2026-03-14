import { z } from 'zod'
import type { Channel } from '~/lib/scheduling/types'
import type { ChannelPreset } from '~/lib/channels/types'
import { extractPlaylistId } from './parser'

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
 * Returns the next available channel number.
 * Always at least 6 (after the 5 preset channels).
 */
export function getNextChannelNumber(
  customChannels: readonly Channel[],
): number {
  if (customChannels.length === 0) return 6
  const maxNumber = Math.max(...customChannels.map((c) => c.number))
  return Math.max(5, maxNumber) + 1
}
