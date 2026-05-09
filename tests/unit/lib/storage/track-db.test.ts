import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { Track } from '~/lib/scheduling/types'
import { saveTracks, loadTracks, deleteTracks } from '~/lib/storage/track-db'

const makeTrack = (id: string, durationSeconds = 180): Track => ({
  id,
  title: `Track ${id}`,
  artist: 'Artist',
  durationSeconds,
  embedUrl: `https://w.soundcloud.com/player/?url=https://soundcloud.com/track/${id}`,
})

describe('saveTracks + loadTracks round-trip', () => {
  beforeEach(async () => {
    await deleteTracks('test-channel')
  })

  it('round-trips a track array', async () => {
    const tracks = [makeTrack('t1'), makeTrack('t2', 240)]
    await saveTracks('test-channel', tracks)
    const loaded = await loadTracks('test-channel')
    expect(loaded).toHaveLength(2)
    expect(loaded?.[0]?.id).toBe('t1')
    expect(loaded?.[1]?.durationSeconds).toBe(240)
  })

  it('returns null when no tracks are stored', async () => {
    const loaded = await loadTracks('nonexistent-channel')
    expect(loaded).toBeNull()
  })

  it('overwrites existing tracks on save', async () => {
    await saveTracks('test-channel', [makeTrack('old')])
    await saveTracks('test-channel', [makeTrack('new1'), makeTrack('new2')])
    const loaded = await loadTracks('test-channel')
    expect(loaded).toHaveLength(2)
    expect(loaded?.[0]?.id).toBe('new1')
  })
})

describe('deleteTracks', () => {
  it('removes stored tracks', async () => {
    await saveTracks('del-channel', [makeTrack('x')])
    await deleteTracks('del-channel')
    const loaded = await loadTracks('del-channel')
    expect(loaded).toBeNull()
  })

  it('is a no-op when no tracks are stored', async () => {
    await expect(deleteTracks('never-saved')).resolves.toBeUndefined()
  })
})
