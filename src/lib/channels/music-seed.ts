import type { Channel } from '~/lib/scheduling/types'
import { importChannel } from '~/lib/import/import-channel'
import { saveTracks } from '~/lib/storage/track-db'
import { saveCustomChannels } from '~/lib/storage/local-channels'
import { getNextChannelNumber } from '~/lib/import/schema'

interface MusicSeed {
  readonly name: string
  readonly url: string
}

export const MUSIC_SEED_CHANNELS: ReadonlyArray<MusicSeed> = [
  { name: 'Calming', url: 'https://soundcloud.com/krunz/sets/calming' },
  {
    name: 'All Time Favorites',
    url: 'https://soundcloud.com/krunz/sets/all-time-favorites',
  },
  {
    name: 'Strato & Krünz',
    url: 'https://soundcloud.com/krunz/sets/strato-kr-nz',
  },
  { name: 'Eclectic', url: 'https://soundcloud.com/krunz/sets/eclectic' },
  { name: 'Deeply Disco', url: 'https://soundcloud.com/krunz/sets/deep-disco' },
  { name: '2016 Sets', url: 'https://soundcloud.com/krunz/sets/2016-sets' },
]

const SEED_FLAG_KEY = 'kranz-tv:music-seed-applied'

/**
 * Seeds the user's custom channels with the curated SoundCloud playlists
 * the first time the app loads. Idempotent via a localStorage flag — once
 * applied, subsequent loads skip the seed even if the user has deleted
 * channels (so deletions stick).
 *
 * Returns the channels that were imported (may be empty if seed already
 * applied or all imports failed).
 */
export async function seedMusicChannelsOnce(
  existing: readonly Channel[],
): Promise<readonly Channel[]> {
  if (typeof window === 'undefined') return []
  if (window.localStorage.getItem(SEED_FLAG_KEY) !== null) return []

  const sourceUrls = new Set(
    existing.filter((c) => c.kind === 'music').map((c) => c.sourceUrl),
  )

  const imported: Channel[] = []
  let nextNumber = getNextChannelNumber(existing)

  for (const seed of MUSIC_SEED_CHANNELS) {
    if (sourceUrls.has(seed.url)) continue
    const result = await importChannel(seed.url, seed.name, nextNumber, '')
    if (result.success) {
      imported.push(result.channel)
      nextNumber++
    }
  }

  // Persist whatever succeeded, then mark seed as applied so we never re-run
  if (imported.length > 0) {
    const merged = [...existing, ...imported]
    saveCustomChannels(merged)
    for (const ch of imported) {
      if (ch.kind === 'music' && ch.tracks) {
        await saveTracks(ch.id, [...ch.tracks])
      }
    }
  }

  window.localStorage.setItem(SEED_FLAG_KEY, '1')
  return imported
}

export function _resetSeedFlagForTests(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(SEED_FLAG_KEY)
  }
}
