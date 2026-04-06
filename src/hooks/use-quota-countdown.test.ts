import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useQuotaCountdown } from './use-quota-countdown'
import { getMillisUntilMidnightPT } from '~/lib/channels/quota-recovery'

vi.mock('~/lib/channels/quota-recovery', () => ({
  getMillisUntilMidnightPT: vi.fn(),
}))

const mockGetMillis = vi.mocked(getMillisUntilMidnightPT)

describe('useQuotaCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockGetMillis.mockReturnValue(3 * 60 * 60 * 1_000 + 42 * 60 * 1_000) // 3h 42m
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when inactive', () => {
    const { result } = renderHook(() => useQuotaCountdown(false))
    expect(result.current).toBeNull()
  })

  it('returns formatted countdown when active', () => {
    const { result } = renderHook(() => useQuotaCountdown(true))
    expect(result.current).toBe('~3h 42m')
  })

  it('formats minutes-only when under 1 hour', () => {
    mockGetMillis.mockReturnValue(25 * 60 * 1_000) // 25m
    const { result } = renderHook(() => useQuotaCountdown(true))
    expect(result.current).toBe('~25m')
  })

  it('updates on interval', () => {
    const { result } = renderHook(() => useQuotaCountdown(true))
    expect(result.current).toBe('~3h 42m')

    mockGetMillis.mockReturnValue(2 * 60 * 60 * 1_000) // 2h 0m
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current).toBe('~2h 0m')
  })

  it('returns null when toggled from active to inactive', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useQuotaCountdown(active),
      { initialProps: { active: true } },
    )
    expect(result.current).toBe('~3h 42m')

    rerender({ active: false })
    expect(result.current).toBeNull()
  })
})
