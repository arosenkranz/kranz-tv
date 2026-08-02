import { describe, it, expect } from 'vitest'
import { CHANNEL_PRESETS } from '../../../src/lib/channels/presets'
import { isSoundCloudUrl } from '../../../src/lib/import/schema'

// Integration test: verify the CHANNEL_PRESETS data contract. The client
// imports CHANNEL_PRESETS directly (there is no server endpoint for it) —
// these tests guard the shape and values of that data.

describe('CHANNEL_PRESETS data contract', () => {
  it('exports exactly 35 channel presets', () => {
    expect(CHANNEL_PRESETS).toHaveLength(35)
  })

  it('every preset has the required shape', () => {
    for (const preset of CHANNEL_PRESETS) {
      const p = preset
      expect(typeof p.id).toBe('string')
      expect(p.id.length).toBeGreaterThan(0)

      expect(typeof p.number).toBe('number')
      expect(p.number).toBeGreaterThan(0)

      expect(typeof p.name).toBe('string')
      expect(p.name.length).toBeGreaterThan(0)

      expect(typeof p.description).toBe('string')
      expect(p.description.length).toBeGreaterThan(0)

      if (p.kind === 'video') {
        expect(typeof p.playlistId).toBe('string')
        expect(p.playlistId.length).toBeGreaterThan(0)
      } else {
        expect(typeof p.sourceUrl).toBe('string')
        expect(p.sourceUrl.length).toBeGreaterThan(0)
      }
    }
  })

  it('channel numbers are sequential from 1 to 35', () => {
    const numbers = [...CHANNEL_PRESETS].map((p) => p.number)
    const sorted = [...numbers].sort((a, b) => a - b)
    expect(sorted).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
    ])
  })

  it('channel ids are unique', () => {
    const ids = CHANNEL_PRESETS.map((p) => p.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('channel numbers are unique', () => {
    const numbers = CHANNEL_PRESETS.map((p) => p.number)
    const unique = new Set(numbers)
    expect(unique.size).toBe(numbers.length)
  })

  it('music preset sourceUrls pass the SoundCloud URL allow-list', () => {
    for (const preset of CHANNEL_PRESETS) {
      if (preset.kind === 'music') {
        expect(isSoundCloudUrl(preset.sourceUrl)).toBe(true)
      }
    }
  })

  it('source IDs are unique (no duplicate playlists)', () => {
    const ids = CHANNEL_PRESETS.map((p) =>
      p.kind === 'video' ? p.playlistId : p.sourceUrl,
    )
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('channel number 1 is Skate Vids (first channel for navigation)', () => {
    const ch1 = CHANNEL_PRESETS.find((p) => p.number === 1)
    expect(ch1).toBeDefined()
    expect(ch1!.id).toBe('skate')
  })
})
