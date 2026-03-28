import type { Channel } from '~/lib/scheduling/types'
import { ChannelArraySchema } from '~/lib/import/schema'
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
    const result = ChannelArraySchema.safeParse(parsed)
    if (!result.success) return []
    return result.data
  } catch {
    return []
  }
}

export interface MergeResult {
  readonly merged: readonly Channel[]
  readonly importedCount: number
  readonly skippedCount: number
}

/**
 * Merges incoming channels into existing ones.
 * Deduplication is by playlistId (semantic identity).
 * Incoming channels whose id collides with a preset id are re-slugged to
 * `{id}-imported` to avoid shadowing preset channels.
 * Returns a new array — never mutates the existing array.
 */
export function mergeCustomChannels(
  existing: readonly Channel[],
  incoming: readonly Channel[],
  presetIds: ReadonlySet<string>,
): MergeResult {
  const existingPlaylistIds = new Set(existing.map((c) => c.playlistId))
  const seenPlaylistIds = new Set(existingPlaylistIds)

  let importedCount = 0
  let skippedCount = 0
  const toAdd: Channel[] = []

  for (const channel of incoming) {
    if (seenPlaylistIds.has(channel.playlistId)) {
      skippedCount++
      continue
    }

    seenPlaylistIds.add(channel.playlistId)

    const resolvedId =
      presetIds.has(channel.id) && !channel.id.endsWith('-imported')
        ? `${channel.id}-imported`
        : channel.id

    toAdd.push({ ...channel, id: resolvedId })
    importedCount++
  }

  return {
    merged: [...existing, ...toAdd],
    importedCount,
    skippedCount,
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
