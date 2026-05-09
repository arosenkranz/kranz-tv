import type {
  Channel,
  MusicChannel,
  ShareRef,
  VideoChannel,
} from '~/lib/scheduling/types'
import { ChannelArraySchema, isSoundCloudUrl } from '~/lib/import/schema'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'

const CUSTOM_CHANNELS_KEY = 'kranz-tv:custom-channels'

/**
 * Semantic identity key for deduplication.
 * VideoChannel uses playlistId; MusicChannel uses sourceUrl.
 */
export function dedupKey(channel: Channel): string {
  return channel.kind === 'video' ? channel.playlistId : channel.sourceUrl
}

/**
 * Strips MusicChannel tracks (stored in IndexedDB) before localStorage persist.
 * Only channel metadata is written to localStorage.
 */
function stripTracksForStorage(channel: Channel): Channel {
  if (channel.kind !== 'music') return channel
  const { tracks: _tracks, ...metadata } = channel as MusicChannel & {
    tracks?: unknown
  }
  return metadata as MusicChannel
}

/**
 * Re-validates all URL fields for a rehydrated channel.
 * Returns null if the channel contains a tampered or invalid URL.
 */
function revalidateChannel(channel: Channel): Channel | null {
  if (channel.kind === 'music') {
    const music = channel
    if (!isSoundCloudUrl(music.sourceUrl)) return null
  }
  return channel
}

export function saveCustomChannels(channels: readonly Channel[]): void {
  if (typeof window === 'undefined') return

  try {
    const stripped = channels.map(stripTracksForStorage)
    window.localStorage.setItem(CUSTOM_CHANNELS_KEY, JSON.stringify(stripped))
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      throw new Error(
        'Storage full — delete a channel to free space before saving new ones',
      )
    }
    throw new Error(
      'Failed to save custom channels: localStorage may be unavailable',
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
      .map(revalidateChannel)
      .filter((c): c is Channel => c !== null)
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
 * Deduplication is by dedupKey (playlistId for video, sourceUrl for music).
 * Incoming channels whose id collides with a preset id are re-slugged to
 * `{id}-imported` to avoid shadowing preset channels.
 * Returns a new array — never mutates the existing array.
 */
export function mergeCustomChannels(
  existing: readonly Channel[],
  incoming: readonly Channel[],
  presetIds: ReadonlySet<string>,
): MergeResult {
  const existingDedupKeys = new Set(existing.map(dedupKey))
  const seenDedupKeys = new Set(existingDedupKeys)

  let importedCount = 0
  let skippedCount = 0
  const toAdd: Channel[] = []

  for (const channel of incoming) {
    const key = dedupKey(channel)
    if (seenDedupKeys.has(key)) {
      skippedCount++
      continue
    }

    seenDedupKeys.add(key)

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

/**
 * Attach a shareRef to the channel with `channelId`. No-op if the channel
 * does not exist. Always writes a new array — never mutates.
 */
export function setShareRef(channelId: string, shareRef: ShareRef): void {
  const existing = loadCustomChannels()
  if (!existing.some((c) => c.id === channelId)) return

  const updated: Channel[] = existing.map((c) =>
    c.id === channelId ? { ...c, shareRef } : c,
  )
  saveCustomChannels(updated)
}

/**
 * Remove the shareRef from the channel with `channelId`. No-op if the
 * channel does not exist or has no shareRef.
 */
export function clearShareRef(channelId: string): void {
  const existing = loadCustomChannels()
  if (!existing.some((c) => c.id === channelId)) return

  const updated: Channel[] = existing.map((c) => {
    if (c.id !== channelId) return c
    if (c.shareRef === undefined) return c
    const { shareRef: _drop, ...rest } = c
    void _drop
    return rest as Channel
  })
  saveCustomChannels(updated)
}

/**
 * Find the locally-persisted channel whose shareRef matches `shareId`.
 * Returns `undefined` if no match exists. Used for idempotent receive.
 */
export function findChannelByShareId(shareId: string): Channel | undefined {
  const existing = loadCustomChannels()
  return existing.find((c) => c.shareRef?.shareId === shareId)
}

export function getAllChannelIds(): readonly string[] {
  const presetIds = CHANNEL_PRESETS.map((p) => p.id)
  const customChannels = loadCustomChannels()
  const customIds = customChannels.map((c) => c.id)

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
