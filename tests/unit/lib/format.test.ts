import { describe, it, expect } from 'vitest'
import { formatChannelNumber } from '~/lib/format'

describe('formatChannelNumber', () => {
  it('pads single digit with leading zero', () => {
    expect(formatChannelNumber(1)).toBe('CH01')
    expect(formatChannelNumber(9)).toBe('CH09')
  })

  it('does not pad double digits', () => {
    expect(formatChannelNumber(10)).toBe('CH10')
    expect(formatChannelNumber(99)).toBe('CH99')
  })

  it('handles zero', () => {
    expect(formatChannelNumber(0)).toBe('CH00')
  })

  it('handles triple digits', () => {
    expect(formatChannelNumber(100)).toBe('CH100')
  })
})
