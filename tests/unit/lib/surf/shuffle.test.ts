import { describe, it, expect } from 'vitest'
import { createShuffleQueue } from '~/lib/surf/shuffle'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const channelIds = ['ch-1', 'ch-2', 'ch-3', 'ch-4', 'ch-5']

/**
 * A deterministic random function that always returns 0.
 * With Fisher-Yates, this means each swap picks the current index,
 * effectively leaving the (filtered) array in its original order.
 */
const zeroRandom = () => 0

/**
 * A deterministic random function that always returns 0.99.
 * With Fisher-Yates, this always picks the last available index,
 * producing a known reversal-like permutation.
 */
const highRandom = () => 0.99

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('createShuffleQueue', () => {
  describe('exclusion', () => {
    it('excludes the current channel from the result', () => {
      const queue = createShuffleQueue(channelIds, 'ch-3', zeroRandom)

      expect(queue).not.toContain('ch-3')
    })

    it('returns all other channels exactly once (set equality)', () => {
      const queue = createShuffleQueue(channelIds, 'ch-1', zeroRandom)

      expect(queue).toHaveLength(4)
      expect(new Set(queue)).toEqual(new Set(['ch-2', 'ch-3', 'ch-4', 'ch-5']))
    })
  })

  describe('edge cases', () => {
    it('returns [] when input is empty', () => {
      const queue = createShuffleQueue([], 'ch-1')

      expect(queue).toEqual([])
    })

    it('returns [] when only the excluded channel remains', () => {
      const queue = createShuffleQueue(['ch-1'], 'ch-1')

      expect(queue).toEqual([])
    })

    it('returns [] when 0 channels remain after exclusion', () => {
      const queue = createShuffleQueue(['only'], 'only')

      expect(queue).toEqual([])
    })

    it('returns the single remaining channel when two channels exist', () => {
      const queue = createShuffleQueue(['ch-1', 'ch-2'], 'ch-1')

      expect(queue).toEqual(['ch-2'])
    })
  })

  describe('reshuffling', () => {
    it('reshuffled queue excludes the last-visited channel', () => {
      const firstQueue = createShuffleQueue(channelIds, 'ch-1', zeroRandom)
      const lastVisited = firstQueue[firstQueue.length - 1]

      const secondQueue = createShuffleQueue(
        channelIds,
        lastVisited,
        zeroRandom,
      )

      expect(secondQueue).not.toContain(lastVisited)
      expect(secondQueue).toHaveLength(4)
    })
  })

  describe('determinism', () => {
    it('produces the same result with the same injected random function', () => {
      let callCount = 0
      const seededRandom = () => {
        callCount++
        return (callCount * 7 + 3) % 11 / 11
      }

      const resetAndCreate = () => {
        callCount = 0
        return createShuffleQueue(channelIds, 'ch-1', seededRandom)
      }

      const first = resetAndCreate()
      const second = resetAndCreate()

      expect(first).toEqual(second)
    })
  })

  describe('immutability', () => {
    it('does NOT mutate the input array', () => {
      const original = ['ch-1', 'ch-2', 'ch-3', 'ch-4', 'ch-5']
      const snapshot = [...original]

      createShuffleQueue(original, 'ch-2')

      expect(original).toEqual(snapshot)
    })
  })

  describe('shuffling behavior', () => {
    it('actually shuffles the order (not just filtering)', () => {
      // With zeroRandom, Fisher-Yates leaves order intact (filtered order)
      const unshuffled = createShuffleQueue(channelIds, 'ch-1', zeroRandom)
      // With highRandom, Fisher-Yates produces a different permutation
      const shuffled = createShuffleQueue(channelIds, 'ch-1', highRandom)

      // Both should have the same elements
      expect(new Set(unshuffled)).toEqual(new Set(shuffled))
      // But different order
      expect(shuffled).not.toEqual(unshuffled)
    })

    it('uses the injected random function for shuffling', () => {
      let called = false
      const trackingRandom = () => {
        called = true
        return 0.5
      }

      createShuffleQueue(channelIds, 'ch-1', trackingRandom)

      expect(called).toBe(true)
    })
  })
})
