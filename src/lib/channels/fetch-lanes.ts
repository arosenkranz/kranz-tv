import type { ChannelPreset } from './types'

export interface FetchLanes {
  readonly videoLane: readonly ChannelPreset[]
  readonly musicLane: readonly ChannelPreset[]
}

/**
 * Partition presets into per-source fetch lanes.
 *
 * The two lanes run concurrently but each lane is internally sequential:
 * the video lane must stay sequential so a YouTubeQuotaError can latch
 * before firing doomed API calls, and the music lane stays sequential so
 * parallel cold requests can't each burn a SoundCloud OAuth token issuance
 * (the module-scope token cache is per-isolate on Cloudflare Workers, so
 * concurrent requests may not share it).
 *
 * The active (deep-linked / currently watched) channel is hoisted to the
 * front of its lane so the channel the viewer is staring at loads first.
 */
export function buildFetchLanes(
  presets: readonly ChannelPreset[],
  activeChannelId: string | null,
): FetchLanes {
  return {
    videoLane: hoistActive(
      presets.filter((p) => p.kind === 'video'),
      activeChannelId,
    ),
    musicLane: hoistActive(
      presets.filter((p) => p.kind === 'music'),
      activeChannelId,
    ),
  }
}

function hoistActive(
  lane: readonly ChannelPreset[],
  activeChannelId: string | null,
): readonly ChannelPreset[] {
  if (activeChannelId === null) return lane
  const idx = lane.findIndex((p) => p.id === activeChannelId)
  if (idx <= 0) return lane
  return [lane[idx], ...lane.slice(0, idx), ...lane.slice(idx + 1)]
}

/**
 * Extract the channel id from a `/channel/:id` pathname. Used by the layout's
 * eager-fetch effect to read the deep-link target directly from the URL:
 * on first mount the child route hasn't registered its channel id in layout
 * state yet (parent effects run after child effects, but the layout renders
 * before the child's state update lands), so the URL is the only reliable
 * source at that moment.
 */
export function channelIdFromPath(pathname: string): string | null {
  const match = /^\/channel\/([^/]+)\/?$/.exec(pathname)
  return match?.[1] ?? null
}
