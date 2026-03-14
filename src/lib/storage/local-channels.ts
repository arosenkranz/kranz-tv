import type { Channel } from '~/lib/scheduling/types'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'

const CUSTOM_CHANNELS_KEY = 'kranz-tv:custom-channels'

export function saveCustomChannels(channels: readonly Channel[]): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(CUSTOM_CHANNELS_KEY, JSON.stringify(channels))
  } catch {
    throw new Error(
      'Failed to save custom channels: localStorage may be full or unavailable',
    )
  }
}

export function loadCustomChannels(): readonly Channel[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(CUSTOM_CHANNELS_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as Channel[]
  } catch {
    return []
  }
}

export function getAllChannelIds(): readonly string[] {
  const presetIds = CHANNEL_PRESETS.map((p) => p.id)
  const customChannels = loadCustomChannels()
  const customIds = customChannels.map((c) => c.id)

  // Deduplicate: custom channels override presets with same id
  const seen = new Set<string>()
  const allIds: string[] = []

  for (const id of [...presetIds, ...customIds]) {
    if (!seen.has(id)) {
      seen.add(id)
      allIds.push(id)
    }
  }

  return allIds
}
