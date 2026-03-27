import { describe, it, expect } from 'vitest'
import { computeCellLayout } from '../../../../src/lib/epg/layout'
import type { EpgEntry } from '../../../../src/lib/scheduling/types'

function makeEntry(startMs: number, endMs: number): EpgEntry {
  return {
    video: {
      id: 'vid1',
      title: 'Test Video',
      durationSeconds: (endMs - startMs) / 1000,
      thumbnailUrl: '',
    },
    channelId: 'ch1',
    startTime: new Date(startMs),
    endTime: new Date(endMs),
    isCurrentlyPlaying: false,
  }
}

const WIN_START = 1000
const WIN_END = 5000

describe('computeCellLayout', () => {
  it('returns full width for entry spanning the entire window', () => {
    const entry = makeEntry(WIN_START, WIN_END)
    const result = computeCellLayout(
      entry,
      new Date(WIN_START),
      new Date(WIN_END),
    )
    expect(result).not.toBeNull()
    expect(result!.leftPct).toBeCloseTo(0)
    expect(result!.widthPct).toBeCloseTo(100)
  })

  it('returns null for zero-duration window', () => {
    const entry = makeEntry(WIN_START, WIN_END)
    const result = computeCellLayout(
      entry,
      new Date(WIN_START),
      new Date(WIN_START),
    )
    expect(result).toBeNull()
  })

  it('returns null for entry entirely before window', () => {
    const entry = makeEntry(0, 500)
    const result = computeCellLayout(
      entry,
      new Date(WIN_START),
      new Date(WIN_END),
    )
    expect(result).toBeNull()
  })

  it('returns null for entry entirely after window', () => {
    const entry = makeEntry(6000, 8000)
    const result = computeCellLayout(
      entry,
      new Date(WIN_START),
      new Date(WIN_END),
    )
    expect(result).toBeNull()
  })

  it('clips entry that starts before window', () => {
    const entry = makeEntry(0, WIN_END)
    const result = computeCellLayout(
      entry,
      new Date(WIN_START),
      new Date(WIN_END),
    )
    expect(result).not.toBeNull()
    expect(result!.leftPct).toBeCloseTo(0)
    expect(result!.widthPct).toBeCloseTo(100)
  })

  it('clips entry that ends after window', () => {
    const entry = makeEntry(WIN_START, 10000)
    const result = computeCellLayout(
      entry,
      new Date(WIN_START),
      new Date(WIN_END),
    )
    expect(result).not.toBeNull()
    expect(result!.leftPct).toBeCloseTo(0)
    expect(result!.widthPct).toBeCloseTo(100)
  })

  it('positions entry in the middle correctly', () => {
    // Window: 0 to 1000ms. Entry: 250 to 750ms → left=25%, width=50%
    const entry = makeEntry(250, 750)
    const result = computeCellLayout(entry, new Date(0), new Date(1000))
    expect(result).not.toBeNull()
    expect(result!.leftPct).toBeCloseTo(25)
    expect(result!.widthPct).toBeCloseTo(50)
  })
})
