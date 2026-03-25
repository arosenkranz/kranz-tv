import { describe, it, expect } from 'vitest'
import {
  VOLUME_STEP,
  VOLUME_DEFAULT,
  clampVolume,
  adjustVolume,
  volumeToSegments,
} from '~/lib/volume'

describe('constants', () => {
  it('VOLUME_STEP is 10', () => {
    expect(VOLUME_STEP).toBe(10)
  })

  it('VOLUME_DEFAULT is 80', () => {
    expect(VOLUME_DEFAULT).toBe(80)
  })
})

describe('clampVolume', () => {
  it('returns value unchanged when within [0, 100]', () => {
    expect(clampVolume(50)).toBe(50)
    expect(clampVolume(0)).toBe(0)
    expect(clampVolume(100)).toBe(100)
  })

  it('clamps negative values to 0', () => {
    expect(clampVolume(-1)).toBe(0)
    expect(clampVolume(-100)).toBe(0)
  })

  it('clamps values above 100 to 100', () => {
    expect(clampVolume(101)).toBe(100)
    expect(clampVolume(999)).toBe(100)
  })

  it('rounds fractional values', () => {
    expect(clampVolume(50.4)).toBe(50)
    expect(clampVolume(50.5)).toBe(51)
    expect(clampVolume(50.6)).toBe(51)
  })

  it('rounds fractional values at the boundaries', () => {
    expect(clampVolume(-0.4)).toBe(0)
    expect(clampVolume(100.4)).toBe(100)
  })
})

describe('adjustVolume', () => {
  it('adds positive delta', () => {
    expect(adjustVolume(70, 10)).toBe(80)
  })

  it('subtracts negative delta', () => {
    expect(adjustVolume(50, -10)).toBe(40)
  })

  it('clamps result at 100', () => {
    expect(adjustVolume(95, 10)).toBe(100)
    expect(adjustVolume(100, 10)).toBe(100)
  })

  it('clamps result at 0', () => {
    expect(adjustVolume(5, -10)).toBe(0)
    expect(adjustVolume(0, -10)).toBe(0)
  })

  it('handles zero delta', () => {
    expect(adjustVolume(60, 0)).toBe(60)
  })

  it('handles large delta', () => {
    expect(adjustVolume(50, 1000)).toBe(100)
    expect(adjustVolume(50, -1000)).toBe(0)
  })
})

describe('volumeToSegments', () => {
  it('returns 0 segments for volume 0', () => {
    expect(volumeToSegments(0, 10)).toBe(0)
  })

  it('returns total segments for volume 100', () => {
    expect(volumeToSegments(100, 10)).toBe(10)
  })

  it('returns half segments for volume 50', () => {
    expect(volumeToSegments(50, 10)).toBe(5)
  })

  it('rounds to nearest segment', () => {
    // 80/100 * 10 = 8.0
    expect(volumeToSegments(80, 10)).toBe(8)
    // 75/100 * 10 = 7.5 -> rounds to 8
    expect(volumeToSegments(75, 10)).toBe(8)
    // 74/100 * 10 = 7.4 -> rounds to 7
    expect(volumeToSegments(74, 10)).toBe(7)
  })

  it('works with different total segment counts', () => {
    expect(volumeToSegments(50, 20)).toBe(10)
    expect(volumeToSegments(100, 5)).toBe(5)
    expect(volumeToSegments(0, 5)).toBe(0)
  })
})
