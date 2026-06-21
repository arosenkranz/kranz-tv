import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Channel, MusicChannel } from '~/lib/scheduling/types'
import { mergeCustomChannels, loadCustomChannels } from '~/lib/storage/local-channels'

const PRESET_IDS = new Set([
  'skate',
  'music',
  'party',
  'favorites',
  'entertainment',
])

const makeChannel = (overrides: Partial<Channel> = {}): Channel =>
  ({
    kind: 'video',
    id: 'my-channel',
    number: 6,
    name: 'My Channel',
    playlistId: 'PLxyz123',
    videos: [],
    totalDurationSeconds: 0,
    ...overrides,
  }) as Channel

describe('mergeCustomChannels', () => {
  describe('happy path — no conflicts', () => {
    it('imports a new channel with no existing channels', () => {
      const result = mergeCustomChannels([], [makeChannel()], PRESET_IDS)
      expect(result.merged).toHaveLength(1)
      expect(result.importedCount).toBe(1)
      expect(result.skippedCount).toBe(0)
    })

    it('appends incoming to existing when no conflicts', () => {
      const existing = [makeChannel({ id: 'existing', playlistId: 'PLexist' })]
      const incoming = [makeChannel({ id: 'new-one', playlistId: 'PLnew' })]
      const result = mergeCustomChannels(existing, incoming, PRESET_IDS)
      expect(result.merged).toHaveLength(2)
      expect(result.importedCount).toBe(1)
      expect(result.skippedCount).toBe(0)
    })
  })

  describe('deduplication by playlistId', () => {
    it('skips a channel whose playlistId already exists in existing channels', () => {
      const existing = [makeChannel({ playlistId: 'PLxyz123' })]
      const incoming = [
        makeChannel({ id: 'dupe', name: 'Dupe Name', playlistId: 'PLxyz123' }),
      ]
      const result = mergeCustomChannels(existing, incoming, PRESET_IDS)
      expect(result.merged).toHaveLength(1)
      expect(result.importedCount).toBe(0)
      expect(result.skippedCount).toBe(1)
    })

    it('skips duplicate even when incoming has a different name', () => {
      const existing = [makeChannel({ playlistId: 'PLabc' })]
      const incoming = [
        makeChannel({ name: 'Totally Different Name', playlistId: 'PLabc' }),
      ]
      const result = mergeCustomChannels(existing, incoming, PRESET_IDS)
      expect(result.skippedCount).toBe(1)
    })

    it('dedupes within the incoming batch itself', () => {
      const ch1 = makeChannel({ id: 'a', playlistId: 'PLsame' })
      const ch2 = makeChannel({ id: 'b', playlistId: 'PLsame' })
      const result = mergeCustomChannels([], [ch1, ch2], PRESET_IDS)
      expect(result.merged).toHaveLength(1)
      expect(result.importedCount).toBe(1)
      expect(result.skippedCount).toBe(1)
    })
  })

  describe('preset ID collision', () => {
    it('re-slugs an incoming channel whose id matches a preset id', () => {
      const incoming = [makeChannel({ id: 'skate', playlistId: 'PLnew' })]
      const result = mergeCustomChannels([], incoming, PRESET_IDS)
      expect(result.merged[0].id).toBe('skate-imported')
      expect(result.importedCount).toBe(1)
    })

    it('does not re-slug when incoming id does not conflict', () => {
      const incoming = [
        makeChannel({ id: 'my-custom', playlistId: 'PLcustom' }),
      ]
      const result = mergeCustomChannels([], incoming, PRESET_IDS)
      expect(result.merged[0].id).toBe('my-custom')
    })

    it('does not re-slug an id that already ends with -imported', () => {
      const incoming = [
        makeChannel({ id: 'skate-imported', playlistId: 'PLnew' }),
      ]
      const result = mergeCustomChannels([], incoming, PRESET_IDS)
      expect(result.merged[0].id).toBe('skate-imported')
    })
  })

  describe('immutability', () => {
    it('does not mutate the existing array', () => {
      const existing = [makeChannel({ playlistId: 'PLold' })]
      const originalLength = existing.length
      mergeCustomChannels(
        existing,
        [makeChannel({ id: 'new', playlistId: 'PLnew' })],
        PRESET_IDS,
      )
      expect(existing).toHaveLength(originalLength)
    })

    it('returns a new array reference', () => {
      const existing = [makeChannel({ playlistId: 'PLold' })]
      const result = mergeCustomChannels(existing, [], PRESET_IDS)
      expect(result.merged).not.toBe(existing)
    })
  })

  describe('empty inputs', () => {
    it('returns empty merged when both existing and incoming are empty', () => {
      const result = mergeCustomChannels([], [], PRESET_IDS)
      expect(result.merged).toHaveLength(0)
      expect(result.importedCount).toBe(0)
      expect(result.skippedCount).toBe(0)
    })
  })
})

const makeMusicChannel = (
  embedUrl = 'https://soundcloud.com/artist/track',
): MusicChannel => ({
  kind: 'music',
  id: 'music-ch',
  number: 10,
  name: 'Music Channel',
  source: 'soundcloud',
  sourceUrl: 'https://soundcloud.com/artist',
  totalDurationSeconds: 200,
  trackCount: 1,
  tracks: [
    {
      id: 'track-1',
      title: 'Track One',
      artist: 'Artist',
      durationSeconds: 200,
      embedUrl,
    },
  ],
})

describe('revalidateChannel — embedUrl allow-list', () => {

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })

  it('loads a music channel with valid SoundCloud embedUrl', () => {
    const channel = makeMusicChannel('https://soundcloud.com/artist/track')
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([channel]))
    const result = loadCustomChannels()
    expect(result).toHaveLength(1)
  })

  it('filters out a music channel with an attacker-controlled embedUrl', () => {
    const channel = makeMusicChannel('https://evil.com/track')
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([channel]))
    const result = loadCustomChannels()
    expect(result).toHaveLength(0)
  })

  it('filters out a music channel with http:// embedUrl', () => {
    const channel = makeMusicChannel('http://soundcloud.com/artist/track')
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([channel]))
    const result = loadCustomChannels()
    expect(result).toHaveLength(0)
  })

  it('loads a channel with multiple valid tracks', () => {
    const channel: MusicChannel = {
      ...makeMusicChannel(),
      trackCount: 2,
      tracks: [
        { id: '1', title: 'A', artist: '', durationSeconds: 100, embedUrl: 'https://soundcloud.com/a/1' },
        { id: '2', title: 'B', artist: '', durationSeconds: 100, embedUrl: 'https://soundcloud.com/a/2' },
      ],
    }
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([channel]))
    const result = loadCustomChannels()
    expect(result).toHaveLength(1)
  })

  it('filters out a channel where one track has an invalid embedUrl', () => {
    const channel: MusicChannel = {
      ...makeMusicChannel(),
      trackCount: 2,
      tracks: [
        { id: '1', title: 'A', artist: '', durationSeconds: 100, embedUrl: 'https://soundcloud.com/a/1' },
        { id: '2', title: 'B', artist: '', durationSeconds: 100, embedUrl: 'https://evil.com/track' },
      ],
    }
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify([channel]))
    const result = loadCustomChannels()
    expect(result).toHaveLength(0)
  })
})
