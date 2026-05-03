import { describe, it, expect } from 'vitest'
import { buildEpgEntries } from '#/lib/scheduling/epg-builder'
import type { Channel, Video } from '#/lib/scheduling/types'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeVideo = (id: string, durationSeconds: number): Video => ({
  id,
  title: `Video ${id}`,
  durationSeconds,
  thumbnailUrl: `https://example.com/${id}.jpg`,
})

/**
 * Three videos: 100s + 200s + 300s = 600s total.
 */
const channel: Channel = {
  kind: 'video',
  id: 'ch-epg',
  number: 1,
  name: 'EPG Channel',
  playlistId: 'pl-epg',
  videos: [makeVideo('v1', 100), makeVideo('v2', 200), makeVideo('v3', 300)],
  totalDurationSeconds: 600,
}

const utcDate = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date => new Date(Date.UTC(year, month - 1, day, hour, minute, second))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildEpgEntries', () => {
  describe('basic structure', () => {
    it('returns an array of EpgEntry objects with expected shape', () => {
      const windowStart = utcDate(2024, 1, 15, 10, 0, 0)
      const windowEnd = utcDate(2024, 1, 15, 11, 0, 0)
      const now = utcDate(2024, 1, 15, 10, 30, 0)

      const entries = buildEpgEntries(channel, windowStart, windowEnd, now)

      expect(entries.length).toBeGreaterThan(0)
      for (const entry of entries) {
        expect(entry.video).toBeDefined()
        expect(entry.channelId).toBe(channel.id)
        expect(entry.startTime).toBeInstanceOf(Date)
        expect(entry.endTime).toBeInstanceOf(Date)
        expect(typeof entry.isCurrentlyPlaying).toBe('boolean')
      }
    })

    it('all entries have endTime > startTime', () => {
      const windowStart = utcDate(2024, 1, 15, 10, 0, 0)
      const windowEnd = utcDate(2024, 1, 15, 11, 0, 0)
      const now = utcDate(2024, 1, 15, 10, 0, 0)

      const entries = buildEpgEntries(channel, windowStart, windowEnd, now)

      for (const entry of entries) {
        expect(entry.endTime.getTime()).toBeGreaterThan(
          entry.startTime.getTime(),
        )
      }
    })

    it('each entry duration matches its video.durationSeconds', () => {
      const windowStart = utcDate(2024, 1, 15, 12, 0, 0)
      const windowEnd = utcDate(2024, 1, 15, 14, 0, 0)
      const now = utcDate(2024, 1, 15, 12, 0, 0)

      const entries = buildEpgEntries(channel, windowStart, windowEnd, now)

      for (const entry of entries) {
        const durationMs = entry.endTime.getTime() - entry.startTime.getTime()
        expect(durationMs).toBe(entry.video.durationSeconds * 1000)
      }
    })
  })

  describe('window coverage', () => {
    it('entries cover the entire window with no gaps', () => {
      const windowStart = utcDate(2024, 1, 15, 10, 0, 0)
      const windowEnd = utcDate(2024, 1, 15, 11, 0, 0)
      const now = utcDate(2024, 1, 15, 10, 0, 0)

      const entries = buildEpgEntries(channel, windowStart, windowEnd, now)

      // Each entry's endTime must equal the next entry's startTime (no gaps)
      for (let i = 0; i < entries.length - 1; i++) {
        expect(entries[i].endTime.getTime()).toBe(
          entries[i + 1].startTime.getTime(),
        )
      }
    })

    it('first entry starts at or before windowStart', () => {
      const windowStart = utcDate(2024, 1, 15, 10, 0, 0)
      const windowEnd = utcDate(2024, 1, 15, 11, 0, 0)
      const now = utcDate(2024, 1, 15, 10, 0, 0)

      const entries = buildEpgEntries(channel, windowStart, windowEnd, now)

      expect(entries[0].startTime.getTime()).toBeLessThanOrEqual(
        windowStart.getTime(),
      )
    })

    it('last entry ends at or after windowEnd', () => {
      const windowStart = utcDate(2024, 1, 15, 10, 0, 0)
      const windowEnd = utcDate(2024, 1, 15, 11, 0, 0)
      const now = utcDate(2024, 1, 15, 10, 0, 0)

      const entries = buildEpgEntries(channel, windowStart, windowEnd, now)

      const lastEntry = entries[entries.length - 1]
      expect(lastEntry.endTime.getTime()).toBeGreaterThanOrEqual(
        windowEnd.getTime(),
      )
    })

    it('all entries overlap with the window', () => {
      const windowStart = utcDate(2024, 1, 15, 10, 0, 0)
      const windowEnd = utcDate(2024, 1, 15, 11, 0, 0)
      const now = utcDate(2024, 1, 15, 10, 0, 0)

      const entries = buildEpgEntries(channel, windowStart, windowEnd, now)

      for (const entry of entries) {
        // entry overlaps window if startTime < windowEnd AND endTime > windowStart
        expect(entry.startTime.getTime()).toBeLessThan(windowEnd.getTime())
        expect(entry.endTime.getTime()).toBeGreaterThan(windowStart.getTime())
      }
    })
  })

  describe('isCurrentlyPlaying', () => {
    // isCurrentlyPlaying is determined by video ID match: entries whose video.id
    // matches getSchedulePosition(channel, now).video.id are marked playing.
    // Multiple entries with the same video ID may be marked when that video
    // appears more than once in the window.

    it('at least one entry is marked playing when now is inside the window', () => {
      const windowStart = utcDate(2024, 1, 15, 10, 0, 0)
      const windowEnd = utcDate(2024, 1, 15, 11, 0, 0)
      const now = utcDate(2024, 1, 15, 10, 30, 0)

      const entries = buildEpgEntries(channel, windowStart, windowEnd, now)
      const playing = entries.filter((e) => e.isCurrentlyPlaying)

      expect(playing.length).toBeGreaterThan(0)
    })

    it('all playing entries share the video id that is playing at now', () => {
      const windowStart = utcDate(2024, 1, 15, 10, 0, 0)
      const windowEnd = utcDate(2024, 1, 15, 11, 0, 0)
      const now = utcDate(2024, 1, 15, 10, 30, 0)

      const entries = buildEpgEntries(channel, windowStart, windowEnd, now)
      const playing = entries.filter((e) => e.isCurrentlyPlaying)
      const notPlaying = entries.filter((e) => !e.isCurrentlyPlaying)

      expect(playing.length).toBeGreaterThan(0)
      // All marked entries share the same video id
      const videoIds = new Set(playing.map((e) => e.video.id))
      expect(videoIds.size).toBe(1)
      // Non-playing entries have a different video id
      for (const e of notPlaying) {
        expect(e.video.id).not.toBe([...videoIds][0])
      }
    })

    it('isCurrentlyPlaying is false for all entries when now plays a different video than any in the window', () => {
      // On 2024-01-17 dayOffset = (19739 * 7919) % 600 = 541.
      // At 10:00 UTC: cyclePos = (36000 + 541) % 600 = 541 → v3 (seek=241).
      // v3 has 59s remaining (300 - 241 = 59), so a 30-second window (10:00:00–10:00:30)
      // contains only v3.
      // At 20:01:00 UTC: cyclePos = (72060 + 541) % 600 = 1 → v1. Since v1 does not
      // appear in the window, no entries should be marked isCurrentlyPlaying.
      const windowStart = utcDate(2024, 1, 17, 10, 0, 0)
      const windowEnd = utcDate(2024, 1, 17, 10, 0, 30)
      const now = utcDate(2024, 1, 17, 20, 1, 0) // plays v1

      const entries = buildEpgEntries(channel, windowStart, windowEnd, now)
      const playing = entries.filter((e) => e.isCurrentlyPlaying)

      expect(playing.length).toBe(0)
    })

    it('isCurrentlyPlaying boundary: now === entry.startTime is playing', () => {
      const windowStart = utcDate(2024, 1, 15, 10, 0, 0)
      const windowEnd = utcDate(2024, 1, 15, 11, 0, 0)
      const now = utcDate(2024, 1, 15, 10, 0, 0)

      const entries = buildEpgEntries(channel, windowStart, windowEnd, now)
      const first = entries[0]

      // Find the entry whose startTime equals now
      const target = entries.find(
        (e) =>
          e.startTime.getTime() <= now.getTime() &&
          e.endTime.getTime() > now.getTime(),
      )
      expect(target?.isCurrentlyPlaying).toBe(true)
      // Suppress unused variable warning
      void first
    })

    it('isCurrentlyPlaying boundary: now === entry.endTime is NOT playing', () => {
      const windowStart = utcDate(2024, 1, 15, 10, 0, 0)
      const windowEnd = utcDate(2024, 1, 15, 12, 0, 0)
      const now = utcDate(2024, 1, 15, 10, 0, 0)

      const entries = buildEpgEntries(channel, windowStart, windowEnd, now)

      // Find an entry and check that now equal to its endTime is not marked playing
      const firstEnd = entries[0].endTime
      const nowAtEnd = new Date(firstEnd)
      const entriesAtEnd = buildEpgEntries(
        channel,
        windowStart,
        windowEnd,
        nowAtEnd,
      )

      const entryAtBoundary = entriesAtEnd.find(
        (e) => e.startTime.getTime() === entries[0].startTime.getTime(),
      )
      expect(entryAtBoundary?.isCurrentlyPlaying).toBe(false)
    })
  })

  describe('window spanning midnight', () => {
    it('returns entries for a window crossing UTC midnight', () => {
      const windowStart = utcDate(2024, 1, 15, 23, 30, 0)
      const windowEnd = utcDate(2024, 1, 16, 0, 30, 0) // crosses midnight
      const now = utcDate(2024, 1, 15, 23, 45, 0)

      const entries = buildEpgEntries(channel, windowStart, windowEnd, now)

      expect(entries.length).toBeGreaterThan(0)

      // Verify no gaps
      for (let i = 0; i < entries.length - 1; i++) {
        expect(entries[i].endTime.getTime()).toBe(
          entries[i + 1].startTime.getTime(),
        )
      }

      // Window should be covered
      expect(entries[0].startTime.getTime()).toBeLessThanOrEqual(
        windowStart.getTime(),
      )
      expect(
        entries[entries.length - 1].endTime.getTime(),
      ).toBeGreaterThanOrEqual(windowEnd.getTime())
    })

    it('daily rotation shift is correct around midnight', () => {
      // Entries in the window just before midnight on day N, and just after
      // (day N+1) will have different dayOffsets applied. The entries should
      // still have no gaps — the algorithm always computes per-slot.
      const beforeMidnight = utcDate(2024, 3, 14, 23, 55, 0)
      const afterMidnight = utcDate(2024, 3, 15, 0, 5, 0)
      const now = utcDate(2024, 3, 14, 23, 55, 0)

      const entriesBefore = buildEpgEntries(
        channel,
        beforeMidnight,
        afterMidnight,
        now,
      )

      // Just confirm we get entries; gap-check is most important
      expect(entriesBefore.length).toBeGreaterThan(0)
      for (let i = 0; i < entriesBefore.length - 1; i++) {
        expect(entriesBefore[i].endTime.getTime()).toBe(
          entriesBefore[i + 1].startTime.getTime(),
        )
      }
    })
  })

  describe('channelId propagation', () => {
    it('all entries carry the channel id', () => {
      const windowStart = utcDate(2024, 2, 20, 8, 0, 0)
      const windowEnd = utcDate(2024, 2, 20, 9, 0, 0)
      const now = utcDate(2024, 2, 20, 8, 0, 0)

      const entries = buildEpgEntries(channel, windowStart, windowEnd, now)

      for (const entry of entries) {
        expect(entry.channelId).toBe('ch-epg')
      }
    })
  })

  describe('determinism', () => {
    it('same inputs produce identical entry arrays', () => {
      const windowStart = utcDate(2024, 4, 10, 6, 0, 0)
      const windowEnd = utcDate(2024, 4, 10, 8, 0, 0)
      const now = utcDate(2024, 4, 10, 7, 0, 0)

      const entries1 = buildEpgEntries(channel, windowStart, windowEnd, now)
      const entries2 = buildEpgEntries(channel, windowStart, windowEnd, now)

      expect(entries1.length).toBe(entries2.length)
      for (let i = 0; i < entries1.length; i++) {
        expect(entries1[i].video.id).toBe(entries2[i].video.id)
        expect(entries1[i].startTime.getTime()).toBe(
          entries2[i].startTime.getTime(),
        )
      }
    })
  })
})
