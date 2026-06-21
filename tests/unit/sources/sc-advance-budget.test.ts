import { describe, it, expect } from 'vitest'
import {
  canAdvance,
  recordAdvance,
  MIN_ADVANCE_INTERVAL_MS,
} from '~/lib/sources/soundcloud/advance-guard'

describe('canAdvance', () => {
  const fresh = { attempts: 0, lastAdvanceMs: 0 }
  it('blocks when trackCount is 0', () => {
    expect(canAdvance(fresh, 0, 10_000)).toBe(false)
  })
  it('blocks once attempts reach trackCount', () => {
    expect(canAdvance({ attempts: 3, lastAdvanceMs: 0 }, 3, 10_000)).toBe(false)
  })
  it('blocks within the minimum interval (rapid finish loop)', () => {
    const s = { attempts: 1, lastAdvanceMs: 10_000 }
    expect(canAdvance(s, 5, 10_000 + MIN_ADVANCE_INTERVAL_MS - 1)).toBe(false)
  })
  it('allows after the interval with budget remaining', () => {
    const s = { attempts: 1, lastAdvanceMs: 10_000 }
    expect(canAdvance(s, 5, 10_000 + MIN_ADVANCE_INTERVAL_MS)).toBe(true)
  })
  it('recordAdvance increments attempts and stamps time', () => {
    expect(recordAdvance(fresh, 5_000)).toEqual({
      attempts: 1,
      lastAdvanceMs: 5_000,
    })
  })
})
