import { describe, it, expect } from 'vitest'
import { parseSoundCloudPlaylistResponse } from '#/routes/api/soundcloud'

const fullTrack = (id: number, title: string, durationMs: number) => ({
  id,
  title,
  duration: durationMs,
  permalink_url: `https://soundcloud.com/artist/${title}`,
  user: { username: 'artist' },
})

describe('parseSoundCloudPlaylistResponse', () => {
  it('parses a fully-populated playlist', () => {
    const raw = {
      title: 'My Playlist',
      tracks: [
        fullTrack(1, 'Track A', 60000),
        fullTrack(2, 'Track B', 120000),
      ],
    }
    const result = parseSoundCloudPlaylistResponse(raw)
    expect(result.title).toBe('My Playlist')
    expect(result.tracks).toHaveLength(2)
    expect(result.totalDurationSeconds).toBe(180)
  })

  it('drops placeholder tracks (private/deleted) instead of failing the whole playlist', () => {
    // The SoundCloud /resolve endpoint returns placeholder objects with only
    // `{ id, kind: 'track' }` for tracks the requester cannot access. Without
    // lenient parsing, one such placeholder would fail Zod validation and the
    // entire channel would refuse to load.
    const raw = {
      title: 'Mostly Public Playlist',
      tracks: [
        fullTrack(1, 'Track A', 60000),
        { id: 999, kind: 'track' }, // placeholder — private/deleted/geo-blocked
        fullTrack(2, 'Track B', 120000),
      ],
    }
    const result = parseSoundCloudPlaylistResponse(raw)
    expect(result.tracks).toHaveLength(2)
    expect(result.tracks.map((t) => t.id)).toEqual(['1', '2'])
    expect(result.totalDurationSeconds).toBe(180)
  })

  it('returns an empty playlist when every track is a placeholder', () => {
    const raw = {
      title: 'All Private',
      tracks: [{ id: 1 }, { id: 2 }, { id: 3 }],
    }
    const result = parseSoundCloudPlaylistResponse(raw)
    expect(result.tracks).toHaveLength(0)
    expect(result.totalDurationSeconds).toBe(0)
  })

  it('truncates to MAX_TRACKS (50) after dropping placeholders', () => {
    const tracks = [
      // 5 placeholders that would otherwise have been counted toward the cap
      ...Array.from({ length: 5 }, (_, i) => ({ id: i + 1000 })),
      // 55 valid tracks — only first 50 should be kept
      ...Array.from({ length: 55 }, (_, i) => fullTrack(i + 1, `Track ${i}`, 1000)),
    ]
    const result = parseSoundCloudPlaylistResponse({ title: 'Big', tracks })
    expect(result.tracks).toHaveLength(50)
  })

  it('sorts tracks by id for deterministic schedule ordering', () => {
    const raw = {
      title: 'Out of Order',
      tracks: [
        fullTrack(30, 'C', 1000),
        fullTrack(10, 'A', 1000),
        fullTrack(20, 'B', 1000),
      ],
    }
    const result = parseSoundCloudPlaylistResponse(raw)
    expect(result.tracks.map((t) => t.id)).toEqual(['10', '20', '30'])
  })
})
