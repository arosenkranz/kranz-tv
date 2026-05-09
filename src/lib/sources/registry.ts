import type { MediaSource, MediaSourceId } from './types'
import { YoutubeAdapter } from './youtube/adapter'
import { SoundCloudAdapter } from './soundcloud/adapter'

const ADAPTERS: readonly MediaSource[] = [YoutubeAdapter, SoundCloudAdapter]

export function detectSource(url: string): MediaSource | null {
  if (!url) return null
  return ADAPTERS.find((a) => a.matchesUrl(url)) ?? null
}

export function sourceFor(id: MediaSourceId): MediaSource | null {
  return ADAPTERS.find((a) => a.id === id) ?? null
}
