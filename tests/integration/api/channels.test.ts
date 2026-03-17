import { describe, it, expect } from 'vitest'
import { CHANNEL_PRESETS } from '../../../src/lib/channels/presets'
import type { ChannelPreset } from '../../../src/lib/channels/types'

// Integration test: verify the data contract that GET /api/channels relies on.
// The route handler returns { channels: CHANNEL_PRESETS } — these tests guard
// the shape and values of that payload.

describe('GET /api/channels data contract', () => {
  it('exports exactly 6 channel presets', () => {
    expect(CHANNEL_PRESETS).toHaveLength(6)
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

      expect(typeof p.playlistId).toBe('string')
      expect(p.playlistId.length).toBeGreaterThan(0)

      expect(typeof p.emoji).toBe('string')
      expect(p.emoji.length).toBeGreaterThan(0)
    }
  })

  it('channel numbers are sequential from 1 to 6', () => {
    const numbers = [...CHANNEL_PRESETS].map((p) => p.number)
    const sorted = [...numbers].sort((a, b) => a - b)
    expect(sorted).toEqual([1, 2, 3, 4, 5, 6])
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

  it('playlistIds are unique (no duplicate playlists)', () => {
    const ids = CHANNEL_PRESETS.map((p) => p.playlistId)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('channel number 1 is Skate Vids (first channel for navigation)', () => {
    const ch1 = CHANNEL_PRESETS.find((p) => p.number === 1)
    expect(ch1).toBeDefined()
    expect(ch1!.id).toBe('skate')
  })

  it('response payload structure matches expected API shape', () => {
    // Simulate what the GET handler returns
    const payload = { channels: CHANNEL_PRESETS }
    expect(payload).toHaveProperty('channels')
    expect(Array.isArray(payload.channels)).toBe(true)
    expect(payload.channels).toHaveLength(6)
  })
})
