/**
 * T006 — Phase 2 local-channels tests for MusicChannel support.
 *
 * Tests:
 * - MusicChannel metadata (without tracks) round-trips through localStorage
 * - dedupKey() returns playlistId for video channels and sourceUrl for music channels
 * - URL re-validation on hydrate rejects tampered sourceUrl
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { VideoChannel, MusicChannel } from '~/lib/scheduling/types'
import {
  saveCustomChannels,
  loadCustomChannels,
  dedupKey,
} from '~/lib/storage/local-channels'

const STORAGE_KEY = 'kranz-tv:custom-channels'

const makeVideoChannel = (
  overrides: Partial<VideoChannel> = {},
): VideoChannel => ({
  kind: 'video',
  id: 'ch-video',
  number: 1,
  name: 'Video Channel',
  playlistId: 'PLabc123',
  videos: [],
  totalDurationSeconds: 0,
  ...overrides,
})

const makeMusicChannel = (
  overrides: Partial<MusicChannel> = {},
): MusicChannel => ({
  kind: 'music',
  id: 'ch-music',
  number: 2,
  name: 'Music Channel',
  source: 'soundcloud',
  sourceUrl: 'https://soundcloud.com/user/sets/playlist',
  totalDurationSeconds: 3600,
  trackCount: 10,
  ...overrides,
})

describe('dedupKey', () => {
  it('returns playlistId for VideoChannel', () => {
    const ch = makeVideoChannel({ playlistId: 'PLmy-playlist' })
    expect(dedupKey(ch)).toBe('PLmy-playlist')
  })

  it('returns sourceUrl for MusicChannel', () => {
    const ch = makeMusicChannel({
      sourceUrl: 'https://soundcloud.com/user/sets/my-mix',
    })
    expect(dedupKey(ch)).toBe('https://soundcloud.com/user/sets/my-mix')
  })
})

describe('saveCustomChannels / loadCustomChannels — MusicChannel round-trip', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('round-trips a VideoChannel through localStorage', () => {
    const ch = makeVideoChannel()
    saveCustomChannels([ch])
    const loaded = loadCustomChannels()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].kind).toBe('video')
    expect((loaded[0] as VideoChannel).playlistId).toBe('PLabc123')
  })

  it('round-trips a MusicChannel metadata (no tracks) through localStorage', () => {
    const ch = makeMusicChannel()
    saveCustomChannels([ch])
    const loaded = loadCustomChannels()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].kind).toBe('music')
    const music = loaded[0] as MusicChannel
    expect(music.sourceUrl).toBe('https://soundcloud.com/user/sets/playlist')
    expect(music.trackCount).toBe(10)
  })

  it('round-trips a mixed array of video and music channels', () => {
    const video = makeVideoChannel()
    const music = makeMusicChannel()
    saveCustomChannels([video, music])
    const loaded = loadCustomChannels()
    expect(loaded).toHaveLength(2)
    expect(loaded.map((c) => c.kind)).toEqual(['video', 'music'])
  })

  it('rejects tampered MusicChannel sourceUrl on hydrate', () => {
    const ch = makeMusicChannel()
    saveCustomChannels([ch])

    // Tamper the stored data to use a bad sourceUrl
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = JSON.parse(raw!)
    parsed[0].sourceUrl = 'https://evil.com/malicious'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))

    const loaded = loadCustomChannels()
    // Tampered channel should be excluded
    expect(loaded.filter((c) => c.kind === 'music')).toHaveLength(0)
  })

  it('preserves legacy VideoChannel records without a kind field', () => {
    // Simulate pre-migration data in localStorage
    const legacy = {
      id: 'legacy-ch',
      number: 5,
      name: 'Legacy',
      playlistId: 'PLlegacy',
      videos: [],
      totalDurationSeconds: 0,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify([legacy]))

    const loaded = loadCustomChannels()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].kind).toBe('video')
  })
})
