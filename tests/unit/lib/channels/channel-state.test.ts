import { describe, it, expect } from 'vitest'
import { isMusicStub, addFailed, clearFailed } from '~/lib/channels/channel-state'
import type { Channel } from '~/lib/scheduling/types'

const musicStub: Channel = {
  kind: 'music', id: 'sc-calming', number: 20, name: 'Calming',
  source: 'soundcloud', sourceUrl: 'https://soundcloud.com/x',
  totalDurationSeconds: 0, trackCount: 0, tracks: [],
}
const loadedMusic: Channel = {
  ...musicStub, totalDurationSeconds: 300, trackCount: 1,
  tracks: [{ id: 't1', title: 'T', artist: 'A', durationSeconds: 300, embedUrl: 'https://sc/1' }],
}
const video: Channel = {
  kind: 'video', id: 'skate', number: 1, name: 'Skate', playlistId: 'PL',
  totalDurationSeconds: 100,
  videos: [{ id: 'v1', title: 'V', durationSeconds: 100, thumbnailUrl: '' }],
}

describe('isMusicStub', () => {
  it('is true for an empty-tracks music channel', () => {
    expect(isMusicStub(musicStub)).toBe(true)
  })
  it('is false for a loaded music channel', () => {
    expect(isMusicStub(loadedMusic)).toBe(false)
  })
  it('is false for a video channel', () => {
    expect(isMusicStub(video)).toBe(false)
  })
  it('is false for undefined', () => {
    expect(isMusicStub(undefined)).toBe(false)
  })
})

describe('addFailed / clearFailed (immutable)', () => {
  it('addFailed returns a new set containing the id', () => {
    const base = new Set<string>()
    const next = addFailed(base, 'sc-calming')
    expect(next.has('sc-calming')).toBe(true)
    expect(base.has('sc-calming')).toBe(false) // original untouched
    expect(next).not.toBe(base)
  })
  it('clearFailed returns a new set without the id', () => {
    const base = new Set(['sc-calming', 'sc-eclectic'])
    const next = clearFailed(base, 'sc-calming')
    expect(next.has('sc-calming')).toBe(false)
    expect(next.has('sc-eclectic')).toBe(true)
    expect(base.has('sc-calming')).toBe(true) // original untouched
  })
  it('clearFailed on an absent id returns an equivalent new set', () => {
    const base = new Set(['sc-eclectic'])
    const next = clearFailed(base, 'not-there')
    expect([...next]).toEqual(['sc-eclectic'])
  })
})
