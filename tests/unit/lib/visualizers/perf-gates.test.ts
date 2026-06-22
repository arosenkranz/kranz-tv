import { describe, it, expect } from 'vitest'
import { dprScaleFor, frameIntervalMsFor } from '~/lib/visualizers/perf-gates'

describe('dprScaleFor', () => {
  it('clamps desktop normal-cost to at most 1.5', () => {
    expect(dprScaleFor('normal', { dpr: 3, isMobile: false })).toBeLessThanOrEqual(1.5)
  })
  it('clamps high-cost lower than normal-cost', () => {
    const hi = dprScaleFor('high', { dpr: 3, isMobile: false })
    const norm = dprScaleFor('normal', { dpr: 3, isMobile: false })
    expect(hi).toBeLessThan(norm)
  })
  it('reduces further on mobile', () => {
    const mobile = dprScaleFor('normal', { dpr: 3, isMobile: true })
    const desktop = dprScaleFor('normal', { dpr: 3, isMobile: false })
    expect(mobile).toBeLessThan(desktop)
  })
  it('never exceeds the device dpr', () => {
    expect(dprScaleFor('low', { dpr: 1, isMobile: false })).toBeLessThanOrEqual(1)
  })
})

describe('frameIntervalMsFor', () => {
  it('does not cap normal or low cost (0 = native refresh)', () => {
    expect(frameIntervalMsFor('normal')).toBe(0)
    expect(frameIntervalMsFor('low')).toBe(0)
  })
  it('caps high cost at ~30fps (>=33ms)', () => {
    expect(frameIntervalMsFor('high')).toBeGreaterThanOrEqual(33)
  })
})
