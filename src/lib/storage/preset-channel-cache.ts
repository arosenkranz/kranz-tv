import type { Channel } from '~/lib/scheduling/types'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'

const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

const cacheKey = (channelId: string): string =>
  `kranz-tv:channel-cache:${channelId}`

interface CachedChannelEntry {
  readonly channel: Channel
  readonly cachedAt: number
}

export function loadCachedChannel(channelId: string): Channel | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(cacheKey(channelId))
    if (raw === null) return null

    const entry: unknown = JSON.parse(raw)
    if (
      entry === null ||
      typeof entry !== 'object' ||
      !('channel' in entry) ||
      !('cachedAt' in entry) ||
      typeof (entry as CachedChannelEntry).cachedAt !== 'number'
    ) {
      window.localStorage.removeItem(cacheKey(channelId))
      return null
    }

    const { channel, cachedAt } = entry as CachedChannelEntry
    if (Date.now() - cachedAt > CACHE_TTL_MS) {
      window.localStorage.removeItem(cacheKey(channelId))
      return null
    }

    return channel
  } catch {
    return null
  }
}

export function saveCachedChannel(channel: Channel): void {
  if (typeof window === 'undefined') return

  try {
    const entry: CachedChannelEntry = { channel, cachedAt: Date.now() }
    window.localStorage.setItem(cacheKey(channel.id), JSON.stringify(entry))
  } catch {
    // Silently swallow QuotaExceededError and other storage errors
  }
}

export function clearPresetChannelCache(): void {
  if (typeof window === 'undefined') return

  for (const preset of CHANNEL_PRESETS) {
    try {
      window.localStorage.removeItem(cacheKey(preset.id))
    } catch {
      // Ignore individual removal errors
    }
  }
}
