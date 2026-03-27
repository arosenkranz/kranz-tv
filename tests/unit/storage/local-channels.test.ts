import { describe, it, expect } from 'vitest'
import type { Channel } from '~/lib/scheduling/types'
import { mergeCustomChannels } from '~/lib/storage/local-channels'

const PRESET_IDS = new Set([
  'skate',
  'music',
  'party',
  'favorites',
  'entertainment',
])

const makeChannel = (overrides: Partial<Channel> = {}): Channel => ({
  id: 'my-channel',
  number: 6,
  name: 'My Channel',
  playlistId: 'PLxyz123',
  videos: [],
  totalDurationSeconds: 0,
  ...overrides,
})

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
