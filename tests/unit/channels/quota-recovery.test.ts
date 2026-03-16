import { describe, it, expect } from 'vitest'
import { getMillisUntilMidnightPT } from '../../../src/lib/channels/quota-recovery.ts'

describe('getMillisUntilMidnightPT', () => {
  it('returns a positive number of milliseconds', () => {
    const ms = getMillisUntilMidnightPT()
    expect(ms).toBeGreaterThan(0)
  })

  it('returns at most 24 hours of milliseconds', () => {
    const ms = getMillisUntilMidnightPT()
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1_000)
  })

  it('is deterministic for the same input', () => {
    const now = new Date('2026-03-15T12:00:00Z')
    const ms1 = getMillisUntilMidnightPT(now)
    const ms2 = getMillisUntilMidnightPT(now)
    expect(ms1).toBe(ms2)
  })

  it('is smaller for times closer to midnight PT', () => {
    // Use January dates so we're firmly in PST (UTC-8) and avoid DST edge cases
    // Jan 15 at 11:45 PM PST = Jan 16 07:45 UTC  → 15 min until midnight
    const nearMidnight = new Date('2026-01-16T07:45:00Z')
    // Jan 15 at 9:00 PM PST = Jan 16 05:00 UTC  → 3 hours until midnight
    const farFromMidnight = new Date('2026-01-16T05:00:00Z')

    const msNear = getMillisUntilMidnightPT(nearMidnight)
    const msFar = getMillisUntilMidnightPT(farFromMidnight)

    expect(msNear).toBeLessThan(msFar)
  })

  it('handles PST (winter time, UTC-8) correctly', () => {
    // January 15 at 6:00 PM PST = January 16 02:00 UTC
    // Midnight PT next day = January 16 08:00 UTC
    // So remaining = 6 hours = 21_600_000 ms
    const now = new Date('2026-01-16T02:00:00Z') // 6 PM PST
    const ms = getMillisUntilMidnightPT(now)
    expect(ms).toBeCloseTo(6 * 60 * 60 * 1_000, -3) // within 1 second
  })

  it('handles PDT (summer time, UTC-7) correctly', () => {
    // July 15 at 6:00 PM PDT = July 16 01:00 UTC
    // Midnight PT next day = July 16 07:00 UTC
    // So remaining = 6 hours = 21_600_000 ms
    const now = new Date('2026-07-16T01:00:00Z') // 6 PM PDT
    const ms = getMillisUntilMidnightPT(now)
    expect(ms).toBeCloseTo(6 * 60 * 60 * 1_000, -3) // within 1 second
  })

  it('returns a minimum of 1 second', () => {
    const ms = getMillisUntilMidnightPT(new Date())
    expect(ms).toBeGreaterThanOrEqual(1_000)
  })
})
