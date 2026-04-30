import { describe, it, expect } from 'vitest'
import { getSchedulePosition } from '#/lib/scheduling/algorithm'
import type { Channel, Video } from '#/lib/scheduling/types'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeVideo = (id: string, durationSeconds: number): Video => ({
  id,
  title: `Video ${id}`,
  durationSeconds,
  thumbnailUrl: `https://example.com/${id}.jpg`,
})

/**
 * A channel with three videos of known durations.
 * Total = 100 + 200 + 300 = 600 seconds.
 */
const threeVideoChannel: Channel = {
  id: 'ch-1',
  number: 1,
  name: 'Test Channel',
  playlistId: 'pl-1',
  videos: [makeVideo('v1', 100), makeVideo('v2', 200), makeVideo('v3', 300)],
  totalDurationSeconds: 600,
}

/**
 * Single-video channel — 500 s long.
 */
const singleVideoChannel: Channel = {
  id: 'ch-single',
  number: 2,
  name: 'Single Video',
  playlistId: 'pl-2',
  videos: [makeVideo('solo', 500)],
  totalDurationSeconds: 500,
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Build a UTC date from its component parts (midnight-relative helpers).
 */
const utcDate = (
  year: number,
  month: number, // 1-based
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date => new Date(Date.UTC(year, month - 1, day, hour, minute, second))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getSchedulePosition', () => {
  describe('basic correctness', () => {
    it('returns a SchedulePosition with expected shape', () => {
      const ts = utcDate(2024, 1, 15, 6, 0, 0)
      const pos = getSchedulePosition(threeVideoChannel, ts)

      expect(pos.video).toBeDefined()
      expect(typeof pos.seekSeconds).toBe('number')
      expect(pos.slotStartTime).toBeInstanceOf(Date)
      expect(pos.slotEndTime).toBeInstanceOf(Date)
    })

    it('returns correct video for a fully calculated known timestamp', () => {
      // Days since epoch for 2024-01-15 (UTC):
      // epoch = 1970-01-01, 2024-01-15 = 19737 full days
      // hoursSinceEpoch at 02:00 UTC = 19737 * 24 + 2 = 473690
      // daily  = (19737 * 7919) % 600 = 303
      // hourly = (473690 * 3607) % 600 = 230
      // combined = (303 + 230) % 600 = 533
      // secSinceMidnight at 02:00:00 UTC = 7200
      // cyclePos = (7200 + 533) % 600 = 7733 % 600 = 533
      // accumulated: v1=100 (0..99), v2=200 (100..299), v3=300 (300..599)
      // 533 falls in v3 (accumulated=300, 300+300=600 > 533)
      // seekSeconds = 533 - 300 = 233
      const ts = utcDate(2024, 1, 15, 2, 0, 0)
      const pos = getSchedulePosition(threeVideoChannel, ts)

      expect(pos.video.id).toBe('v3')
      expect(pos.seekSeconds).toBe(233)
    })

    it('seekSeconds is within [0, video.durationSeconds)', () => {
      const timestamps = [
        utcDate(2024, 1, 1, 0, 0, 0),
        utcDate(2024, 1, 1, 12, 0, 0),
        utcDate(2024, 6, 15, 8, 30, 45),
        utcDate(2024, 12, 31, 23, 59, 59),
      ]

      for (const ts of timestamps) {
        const pos = getSchedulePosition(threeVideoChannel, ts)
        expect(pos.seekSeconds).toBeGreaterThanOrEqual(0)
        expect(pos.seekSeconds).toBeLessThan(pos.video.durationSeconds)
      }
    })

    it('slotStartTime + seekSeconds reconstructs the original timestamp (within 1s)', () => {
      const ts = utcDate(2024, 3, 20, 14, 22, 37)
      const pos = getSchedulePosition(threeVideoChannel, ts)

      const reconstructed = new Date(
        pos.slotStartTime.getTime() + pos.seekSeconds * 1000,
      )
      expect(Math.abs(reconstructed.getTime() - ts.getTime())).toBeLessThan(
        1000,
      )
    })

    it('slotEndTime - slotStartTime equals video.durationSeconds exactly', () => {
      const ts = utcDate(2024, 5, 10, 9, 0, 0)
      const pos = getSchedulePosition(threeVideoChannel, ts)

      const durationMs = pos.slotEndTime.getTime() - pos.slotStartTime.getTime()
      expect(durationMs).toBe(pos.video.durationSeconds * 1000)
    })
  })

  describe('determinism', () => {
    it('same inputs always produce the same output', () => {
      const ts = utcDate(2024, 7, 4, 20, 15, 0)

      const pos1 = getSchedulePosition(threeVideoChannel, ts)
      const pos2 = getSchedulePosition(threeVideoChannel, ts)

      expect(pos1.video.id).toBe(pos2.video.id)
      expect(pos1.seekSeconds).toBe(pos2.seekSeconds)
      expect(pos1.slotStartTime.getTime()).toBe(pos2.slotStartTime.getTime())
      expect(pos1.slotEndTime.getTime()).toBe(pos2.slotEndTime.getTime())
    })

    it('two timestamps 1 second apart yield seekSeconds differing by 1 (within same video)', () => {
      // Choose a timestamp that lands well inside v1 (0..99) so a 1s advance stays in it.
      // We need cyclePos to be small enough. We'll pick a timestamp and verify.
      const ts1 = utcDate(2024, 1, 1, 0, 0, 0)
      const ts2 = utcDate(2024, 1, 1, 0, 0, 1)

      const pos1 = getSchedulePosition(threeVideoChannel, ts1)
      const pos2 = getSchedulePosition(threeVideoChannel, ts2)

      if (pos1.video.id === pos2.video.id) {
        expect(pos2.seekSeconds).toBe(pos1.seekSeconds + 1)
      } else {
        // Video boundary crossed — slotStartTime should be ts2 adjusted to start
        expect(pos2.seekSeconds).toBe(0)
      }
    })
  })

  describe('daily rotation', () => {
    it('different days produce a different cyclePos offset', () => {
      // Same time of day, adjacent days — dayOffset differs so output likely differs.
      const day1 = utcDate(2024, 1, 1, 6, 0, 0)
      const day2 = utcDate(2024, 1, 2, 6, 0, 0)

      const pos1 = getSchedulePosition(threeVideoChannel, day1)
      const pos2 = getSchedulePosition(threeVideoChannel, day2)

      // The two positions should not be identical (different cyclePos)
      // cyclePos day1 vs day2 differs by (7919 % 600) = 119 seconds in the playlist
      expect(
        pos1.video.id !== pos2.video.id ||
          pos1.seekSeconds !== pos2.seekSeconds,
      ).toBe(true)
    })

    it('rotation is deterministic across calls on the same day', () => {
      const morning = utcDate(2024, 6, 21, 8, 0, 0)
      const evening = utcDate(2024, 6, 21, 20, 0, 0)

      // They differ in secSinceMidnight but share dayOffset — both deterministic
      const pos1a = getSchedulePosition(threeVideoChannel, morning)
      const pos1b = getSchedulePosition(threeVideoChannel, morning)
      const pos2a = getSchedulePosition(threeVideoChannel, evening)
      const pos2b = getSchedulePosition(threeVideoChannel, evening)

      expect(pos1a.video.id).toBe(pos1b.video.id)
      expect(pos2a.video.id).toBe(pos2b.video.id)
    })
  })

  describe('single-video channel', () => {
    it('always returns the single video regardless of timestamp', () => {
      const timestamps = [
        utcDate(2024, 1, 1, 0, 0, 0),
        utcDate(2024, 6, 15, 12, 30, 0),
        utcDate(2024, 12, 31, 23, 59, 59),
      ]

      for (const ts of timestamps) {
        const pos = getSchedulePosition(singleVideoChannel, ts)
        expect(pos.video.id).toBe('solo')
      }
    })

    it('seek varies by time within the single video', () => {
      const ts1 = utcDate(2024, 3, 10, 1, 0, 0)
      const ts2 = utcDate(2024, 3, 10, 1, 5, 0) // 300s later

      const pos1 = getSchedulePosition(singleVideoChannel, ts1)
      const pos2 = getSchedulePosition(singleVideoChannel, ts2)

      expect(pos1.video.id).toBe('solo')
      expect(pos2.video.id).toBe('solo')
      // Two timestamps 300s apart: cyclePos advances by exactly 300 mod 500.
      // (pos2 - pos1 + total) % total handles wraparound correctly.
      const total = singleVideoChannel.totalDurationSeconds
      const forward = (pos2.seekSeconds - pos1.seekSeconds + total) % total
      expect(forward).toBe(300)
    })

    it('seekSeconds is always within [0, 500)', () => {
      const timestamps = [
        utcDate(2024, 1, 1, 0, 0, 0),
        utcDate(2024, 1, 1, 0, 8, 19),
        utcDate(2024, 11, 11, 11, 11, 11),
      ]
      for (const ts of timestamps) {
        const pos = getSchedulePosition(singleVideoChannel, ts)
        expect(pos.seekSeconds).toBeGreaterThanOrEqual(0)
        expect(pos.seekSeconds).toBeLessThan(500)
      }
    })
  })

  describe('edge case: cyclePos = 0', () => {
    it('returns first video with seekSeconds = 0 when cyclePos is exactly 0', () => {
      // We need (secSinceMidnight + dayOffset) % totalDurationSeconds === 0.
      // Craft: totalDuration = 600.
      // Pick a date where dayOffset = D, and secSinceMidnight = 600 - D (or 0 if D=0).
      // Days since epoch for 1970-01-01 = 0, dayOffset = (0 * 127) % 600 = 0.
      // secSinceMidnight at midnight = 0. cyclePos = (0 + 0) % 600 = 0. ✓
      const epochDay = new Date(Date.UTC(1970, 0, 1, 0, 0, 0))
      const pos = getSchedulePosition(threeVideoChannel, epochDay)

      expect(pos.video.id).toBe('v1')
      expect(pos.seekSeconds).toBe(0)
    })
  })

  describe('totalDurationSeconds consistency', () => {
    it('totalDurationSeconds equals sum of video durations', () => {
      const sum = threeVideoChannel.videos.reduce(
        (acc, v) => acc + v.durationSeconds,
        0,
      )
      expect(sum).toBe(threeVideoChannel.totalDurationSeconds)
    })

    it('cyclePos is always within [0, totalDurationSeconds)', () => {
      // Verified indirectly: seekSeconds < video.durationSeconds and
      // the video selection walk covers the full range.
      const timestamps = Array.from({ length: 50 }, (_, i) =>
        utcDate(2024, 1, (i % 28) + 1, (i * 7) % 24, (i * 13) % 60, i % 60),
      )

      for (const ts of timestamps) {
        const pos = getSchedulePosition(threeVideoChannel, ts)
        expect(pos.seekSeconds).toBeGreaterThanOrEqual(0)
        expect(pos.seekSeconds).toBeLessThan(pos.video.durationSeconds)
        expect(['v1', 'v2', 'v3']).toContain(pos.video.id)
      }
    })
  })
})
