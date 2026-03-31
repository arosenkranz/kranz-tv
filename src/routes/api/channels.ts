import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import type { ChannelPreset } from '~/lib/channels/types'
import {
  incrementMetric,
  recordHistogram,
  recordGauge,
} from '~/lib/datadog/server-metrics'

export interface ChannelsResponse {
  channels: readonly ChannelPreset[]
}

export const getChannels = createServerFn({ method: 'GET' }).handler(
  (): ChannelsResponse => {
    const start = performance.now()
    const result = { channels: CHANNEL_PRESETS }
    recordHistogram('kranz_tv.server.channels_ms', performance.now() - start)
    incrementMetric('kranz_tv.server.channels_request')
    recordGauge('kranz_tv.server.preset_channels', CHANNEL_PRESETS.length)
    return result
  },
)

export const Route = createFileRoute('/api/channels')({
  // No UI component — this route exposes getChannels as a server function.
  // Call getChannels() from client code to fetch the list.
})
