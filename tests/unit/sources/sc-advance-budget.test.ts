import { describe, it, expect } from 'vitest'
import {
  canAdvance,
  canAdvanceOnFinish,
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

  it('error path still bounds by trackCount even after the interval', () => {
    // attempts exhausted: every track tried → no further advance, regardless
    // of how much time has passed.
    const s = { attempts: 4, lastAdvanceMs: 10_000 }
    expect(canAdvance(s, 4, 10_000 + MIN_ADVANCE_INTERVAL_MS * 100)).toBe(false)
  })
})

describe('canAdvanceOnFinish', () => {
  it('blocks within the minimum interval (rapid zero-duration loop)', () => {
    const s = { attempts: 1, lastAdvanceMs: 10_000 }
    expect(canAdvanceOnFinish(s, 10_000 + MIN_ADVANCE_INTERVAL_MS - 1)).toBe(
      false,
    )
  })

  it('allows after the interval', () => {
    const s = { attempts: 1, lastAdvanceMs: 10_000 }
    expect(canAdvanceOnFinish(s, 10_000 + MIN_ADVANCE_INTERVAL_MS)).toBe(true)
  })

  it('does NOT bound finish by trackCount — many sequential finishes all advance', () => {
    // Regression: a continuously-playing N-track channel must keep advancing
    // forever. Simulate a long session of natural finishes spaced well past
    // the interval; attempts climbs far beyond trackCount but every finish is
    // still permitted.
    const trackCount = 3
    let state = { attempts: 0, lastAdvanceMs: 0 }
    let now = 0
    for (let i = 0; i < trackCount * 10; i++) {
      // Natural tracks finish minutes apart — well past MIN_ADVANCE_INTERVAL_MS.
      now += 4 * 60_000
      expect(canAdvanceOnFinish(state, now)).toBe(true)
      state = recordAdvance(state, now)
    }
    // attempts has long exceeded trackCount, yet finish still advanced.
    expect(state.attempts).toBe(trackCount * 10)
  })
})
