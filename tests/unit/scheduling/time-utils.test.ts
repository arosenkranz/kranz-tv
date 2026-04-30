import { describe, it, expect } from 'vitest'
import {
  getSecondsSinceMidnightUTC,
  getDaysSinceEpoch,
  getHoursSinceEpoch,
  getDailyRotationSeed,
  stringToSeed,
  seededShuffle,
} from '#/lib/scheduling/time-utils'

describe('getSecondsSinceMidnightUTC', () => {
  it('returns 0 at midnight UTC', () => {
    expect(getSecondsSinceMidnightUTC(new Date('2024-01-01T00:00:00Z'))).toBe(0)
  })

  it('returns 3600 at 01:00 UTC', () => {
    expect(getSecondsSinceMidnightUTC(new Date('2024-01-01T01:00:00Z'))).toBe(
      3600,
    )
  })

  it('returns 86399 at 23:59:59 UTC', () => {
    expect(getSecondsSinceMidnightUTC(new Date('2024-01-01T23:59:59Z'))).toBe(
      86399,
    )
  })
})

describe('getDaysSinceEpoch', () => {
  it('returns 0 for epoch start', () => {
    expect(getDaysSinceEpoch(new Date('1970-01-01T00:00:00Z'))).toBe(0)
  })

  it('returns 1 for the second day', () => {
    expect(getDaysSinceEpoch(new Date('1970-01-02T00:00:00Z'))).toBe(1)
  })
})

describe('getHoursSinceEpoch', () => {
  it('returns 0 at epoch start', () => {
    expect(getHoursSinceEpoch(new Date('1970-01-01T00:00:00Z'))).toBe(0)
  })

  it('returns 1 one hour after epoch', () => {
    expect(getHoursSinceEpoch(new Date('1970-01-01T01:00:00Z'))).toBe(1)
  })

  it('returns 24 one day after epoch', () => {
    expect(getHoursSinceEpoch(new Date('1970-01-02T00:00:00Z'))).toBe(24)
  })
})

describe('getDailyRotationSeed', () => {
  it('returns a value within totalDurationSeconds', () => {
    const total = 10000
    const seed = getDailyRotationSeed(new Date('2024-06-15T12:00:00Z'), total)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(total)
  })

  it('returns different values on different days', () => {
    const total = 100000
    const day1 = getDailyRotationSeed(new Date('2024-01-01T00:00:00Z'), total)
    const day2 = getDailyRotationSeed(new Date('2024-01-02T00:00:00Z'), total)
    expect(day1).not.toBe(day2)
  })

  it('returns different values on different hours of the same day', () => {
    const total = 100000
    const hour1 = getDailyRotationSeed(new Date('2024-06-15T08:00:00Z'), total)
    const hour2 = getDailyRotationSeed(new Date('2024-06-15T09:00:00Z'), total)
    expect(hour1).not.toBe(hour2)
  })
})

// ─── stringToSeed ─────────────────────────────────────────────────────────────

describe('stringToSeed', () => {
  it('returns a non-negative integer', () => {
    expect(stringToSeed('skate')).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(stringToSeed('skate'))).toBe(true)
  })

  it('is deterministic — same input, same output', () => {
    expect(stringToSeed('club-krunz')).toBe(stringToSeed('club-krunz'))
  })

  it('produces different seeds for different channel IDs', () => {
    expect(stringToSeed('skate')).not.toBe(stringToSeed('music'))
    expect(stringToSeed('party')).not.toBe(stringToSeed('slow'))
  })

  it('handles empty string without throwing', () => {
    expect(() => stringToSeed('')).not.toThrow()
  })
})

// ─── seededShuffle ────────────────────────────────────────────────────────────

describe('seededShuffle', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

  it('returns an array with all original elements', () => {
    const result = seededShuffle(items, 42)
    expect(result).toHaveLength(items.length)
    expect(result.sort()).toEqual([...items].sort())
  })

  it('is deterministic — same seed produces same order', () => {
    const r1 = seededShuffle(items, 123)
    const r2 = seededShuffle(items, 123)
    expect(r1).toEqual(r2)
  })

  it('produces different orderings for different seeds', () => {
    const r1 = seededShuffle(items, 1)
    const r2 = seededShuffle(items, 9999)
    expect(r1).not.toEqual(r2)
  })

  it('does not mutate the input array', () => {
    const original = [...items]
    seededShuffle(items, 42)
    expect(items).toEqual(original)
  })

  it('handles a single-element array', () => {
    expect(seededShuffle(['only'], 0)).toEqual(['only'])
  })

  it('handles an empty array', () => {
    expect(seededShuffle([], 0)).toEqual([])
  })
})
