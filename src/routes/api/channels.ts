import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import type { ChannelPreset } from '~/lib/channels/types'

export interface ChannelsResponse {
  channels: readonly ChannelPreset[]
}

export const getChannels = createServerFn({ method: 'GET' }).handler(
  (): ChannelsResponse => ({
    channels: CHANNEL_PRESETS,
  }),
)

export const Route = createFileRoute('/api/channels')({
  // No UI component — this route exposes getChannels as a server function.
  // Call getChannels() from client code to fetch the list.
})
