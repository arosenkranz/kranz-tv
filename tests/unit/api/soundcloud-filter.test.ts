import { describe, it, expect } from 'vitest'
import { isPlayableTrack } from '~/routes/api/soundcloud'
import type { ScTrack } from '~/routes/api/soundcloud'

function makeTrack(overrides: Partial<ScTrack> = {}): ScTrack {
  return {
    id: 1,
    title: 'Track Title',
    duration: 180_000,
    permalink_url: 'https://soundcloud.com/user/track',
    user: { username: 'user' },
    streamable: true,
    policy: null,
    access: 'playable',
    ...overrides,
  }
}

describe('isPlayableTrack', () => {
  it('keeps tracks with access "playable"', () => {
    expect(isPlayableTrack(makeTrack({ access: 'playable' }))).toBe(true)
  })

  it('keeps tracks with access absent (undefined)', () => {
    expect(isPlayableTrack(makeTrack({ access: undefined }))).toBe(true)
  })

  it('keeps tracks with access null', () => {
    expect(isPlayableTrack(makeTrack({ access: null }))).toBe(true)
  })

  it('filters out tracks with access "preview" (30s snippet, full duration reported)', () => {
    expect(isPlayableTrack(makeTrack({ access: 'preview' }))).toBe(false)
  })

  it('filters out tracks with access "blocked"', () => {
    expect(isPlayableTrack(makeTrack({ access: 'blocked' }))).toBe(false)
  })
})
