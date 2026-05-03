/**
 * T007 — Phase 2 algorithm tests extended with MusicChannel fixtures.
 *
 * Proves that getSchedulePosition works identically for VideoChannel and
 * MusicChannel — same deterministic algorithm body, same invariants.
 */
import { describe, it, expect } from 'vitest'
import { getSchedulePosition } from '#/lib/scheduling/algorithm'
import type { MusicChannel, VideoChannel } from '#/lib/scheduling/types'

const utcDate = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date => new Date(Date.UTC(year, month - 1, day, hour, minute, second))

// A MusicChannel with known track durations that mirror the existing VideoChannel fixture
// Total = 100 + 200 + 300 = 600 seconds (same as threeVideoChannel in the existing suite)
const threTrackMusicChannel: MusicChannel = {
  kind: 'music',
  id: 'mc-1',
  number: 10,
  name: 'Music Test',
  source: 'soundcloud',
  sourceUrl: 'https://soundcloud.com/user/sets/test',
  totalDurationSeconds: 600,
  trackCount: 3,
  tracks: [
    { id: 't1', title: 'Track 1', artist: 'Artist A', durationSeconds: 100, embedUrl: 'https://w.soundcloud.com/player/?url=1' },
    { id: 't2', title: 'Track 2', artist: 'Artist B', durationSeconds: 200, embedUrl: 'https://w.soundcloud.com/player/?url=2' },
    { id: 't3', title: 'Track 3', artist: 'Artist C', durationSeconds: 300, embedUrl: 'https://w.soundcloud.com/player/?url=3' },
  ],
}

// Single-track music channel
const singleTrackMusicChannel: MusicChannel = {
  kind: 'music',
  id: 'mc-single',
  number: 11,
  name: 'Single Track',
  source: 'soundcloud',
  sourceUrl: 'https://soundcloud.com/user/sets/single',
  totalDurationSeconds: 500,
  trackCount: 1,
  tracks: [
    { id: 'solo', title: 'Solo Track', artist: 'DJ Solo', durationSeconds: 500, embedUrl: 'https://w.soundcloud.com/player/?url=solo' },
  ],
}

// The equivalent VideoChannel for cross-type determinism check
const equivalentVideoChannel: VideoChannel = {
  kind: 'video',
  id: 'vc-equiv',
  number: 12,
  name: 'Equivalent Video',
  playlistId: 'PLabc',
  totalDurationSeconds: 600,
  videos: [
    { id: 't1', title: 'Track 1', durationSeconds: 100, thumbnailUrl: '' },
    { id: 't2', title: 'Track 2', durationSeconds: 200, thumbnailUrl: '' },
    { id: 't3', title: 'Track 3', durationSeconds: 300, thumbnailUrl: '' },
  ],
}

describe('getSchedulePosition — MusicChannel', () => {
  describe('basic correctness', () => {
    it('returns a SchedulePosition with expected shape for MusicChannel', () => {
      const ts = utcDate(2024, 1, 15, 6, 0, 0)
      const pos = getSchedulePosition(threTrackMusicChannel, ts)

      expect(pos.item).toBeDefined()
      expect(typeof pos.seekSeconds).toBe('number')
      expect(pos.slotStartTime).toBeInstanceOf(Date)
      expect(pos.slotEndTime).toBeInstanceOf(Date)
    })

    it('returns the same item id as the equivalent VideoChannel for identical timestamps', () => {
      const timestamps = [
        utcDate(2024, 1, 15, 2, 0, 0),
        utcDate(2024, 6, 15, 12, 30, 0),
        utcDate(2024, 12, 31, 23, 59, 59),
      ]

      for (const ts of timestamps) {
        const musicPos = getSchedulePosition(threTrackMusicChannel, ts)
        const videoPos = getSchedulePosition(equivalentVideoChannel, ts)
        // Same ID, same seek — algorithm body is shared
        expect(musicPos.item.id).toBe(videoPos.item.id)
        expect(musicPos.seekSeconds).toBe(videoPos.seekSeconds)
      }
    })

    it('seekSeconds is within [0, item.durationSeconds)', () => {
      const timestamps = [
        utcDate(2024, 1, 1, 0, 0, 0),
        utcDate(2024, 1, 1, 12, 0, 0),
        utcDate(2024, 6, 15, 8, 30, 45),
        utcDate(2024, 12, 31, 23, 59, 59),
      ]

      for (const ts of timestamps) {
        const pos = getSchedulePosition(threTrackMusicChannel, ts)
        expect(pos.seekSeconds).toBeGreaterThanOrEqual(0)
        expect(pos.seekSeconds).toBeLessThan(pos.item.durationSeconds)
      }
    })

    it('slotEndTime - slotStartTime equals item.durationSeconds exactly', () => {
      const ts = utcDate(2024, 5, 10, 9, 0, 0)
      const pos = getSchedulePosition(threTrackMusicChannel, ts)
      const durationMs = pos.slotEndTime.getTime() - pos.slotStartTime.getTime()
      expect(durationMs).toBe(pos.item.durationSeconds * 1000)
    })
  })

  describe('determinism', () => {
    it('same inputs always produce the same output for MusicChannel', () => {
      const ts = utcDate(2024, 7, 4, 20, 15, 0)
      const pos1 = getSchedulePosition(threTrackMusicChannel, ts)
      const pos2 = getSchedulePosition(threTrackMusicChannel, ts)

      expect(pos1.item.id).toBe(pos2.item.id)
      expect(pos1.seekSeconds).toBe(pos2.seekSeconds)
    })
  })

  describe('single-track channel', () => {
    it('always returns the single track regardless of timestamp', () => {
      const timestamps = [
        utcDate(2024, 1, 1, 0, 0, 0),
        utcDate(2024, 6, 15, 12, 30, 0),
        utcDate(2024, 12, 31, 23, 59, 59),
      ]

      for (const ts of timestamps) {
        const pos = getSchedulePosition(singleTrackMusicChannel, ts)
        expect(pos.item.id).toBe('solo')
      }
    })
  })

  describe('algorithm body is unchanged', () => {
    it('returns track at known deterministic position (same math as video path)', () => {
      // This mirrors the existing video test at 2024-01-15 02:00:00 UTC
      // cyclePos = 533 → falls in item with accumulated=300 (t3), seek=233
      const ts = utcDate(2024, 1, 15, 2, 0, 0)
      const pos = getSchedulePosition(threTrackMusicChannel, ts)

      expect(pos.item.id).toBe('t3')
      expect(pos.seekSeconds).toBe(233)
    })
  })
})
