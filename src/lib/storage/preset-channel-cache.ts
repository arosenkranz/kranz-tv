import type { Channel } from '~/lib/scheduling/types'
import { ChannelSchema } from '~/lib/import/schema'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import { trackScCacheEvent } from '~/lib/datadog/rum'

const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

// v2: cache key bumped to invalidate all entries cached with the old
// seededShuffle ordering, which produced unstable schedules when playlists changed.
const CACHE_KEY_PREFIX = 'kranz-tv:channel-cache-v2:'
const cacheKey = (channelId: string): string =>
  `${CACHE_KEY_PREFIX}${channelId}`

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

    // Validate cached data to prevent localStorage poisoning attacks
    const validated = ChannelSchema.safeParse(channel)
    if (!validated.success) {
      window.localStorage.removeItem(cacheKey(channelId))
      return null
    }

    // Invalidate caches whose kind no longer matches the preset.
    // Catches the case where a music preset got cached as a fallback mock
    // VideoChannel (e.g. import error) — without this, the bad entry sticks
    // for the full TTL.
    const preset = CHANNEL_PRESETS.find((p) => p.id === channelId)
    if (preset !== undefined && preset.kind !== validated.data.kind) {
      window.localStorage.removeItem(cacheKey(channelId))
      return null
    }

    // Invalidate music channel caches where embedUrl is a pre-encoded widget URL
    // (the old format: https://w.soundcloud.com/player/?url=...). The correct
    // format is a raw SC permalink (https://soundcloud.com/artist/track).
    const ch = validated.data
    if (ch.kind === 'music' && ch.tracks?.some(
      (t) => t.embedUrl.startsWith('https://w.soundcloud.com'),
    )) {
      window.localStorage.removeItem(cacheKey(channelId))
      return null
    }

    return validated.data as Channel
  } catch {
    return null
  }
}

export function clearAllChannelCache(): void {
  if (typeof window === 'undefined') return
  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const key = window.localStorage.key(i)
    if (key?.startsWith(CACHE_KEY_PREFIX)) {
      try {
        window.localStorage.removeItem(key)
      } catch {
        // ignore
      }
    }
  }
}

export function saveCachedChannel(channel: Channel): void {
  if (typeof window === 'undefined') return

  const entry: CachedChannelEntry = { channel, cachedAt: Date.now() }
  const payload = JSON.stringify(entry)
  try {
    window.localStorage.setItem(cacheKey(channel.id), payload)
  } catch {
    // Quota likely exceeded — purge all channel cache entries and retry once.
    clearAllChannelCache()
    try {
      window.localStorage.setItem(cacheKey(channel.id), payload)
    } catch {
      // Only music is instrumented here — video has separate YouTube-quota telemetry.
      if (channel.kind === 'music') trackScCacheEvent('write_failed', channel.id)
    }
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
