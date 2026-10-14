import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChannelSurf } from '~/hooks/use-channel-surf'
import type { ChannelPreset } from '~/lib/channels/types'

const channel: ChannelPreset = {
  kind: 'video',
  id: 'nature',
  number: 1,
  name: 'Nature',
  description: 'Nature channel',
  playlistId: 'PLnature',
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useChannelSurf', () => {
  it('does not animate for direct navigation', () => {
    const { result } = renderHook(() => useChannelSurf())

    act(() => {
      result.current.triggerSurf(channel)
    })

    expect(result.current.surfState.showStatic).toBe(false)
    expect(result.current.surfState.showOsd).toBe(false)
    expect(result.current.surfState.channel).toBeNull()
  })

  it('shows static and OSD for keyboard navigation, then fades both', () => {
    const { result } = renderHook(() => useChannelSurf())

    act(() => {
      result.current.setNavigationSource('keyboard')
      result.current.triggerSurf(channel)
    })

    expect(result.current.surfState.showStatic).toBe(true)
    expect(result.current.surfState.showOsd).toBe(true)
    expect(result.current.surfState.channel).toBe(channel)
    expect(result.current.surfState.navigationSource).toBe('keyboard')

    act(() => {
      vi.advanceTimersByTime(300 + 370)
    })
    expect(result.current.surfState.showStatic).toBe(false)

    act(() => {
      vi.advanceTimersByTime(2000 - 370)
    })
    expect(result.current.surfState.showOsd).toBe(false)
  })

  it('reschedules pending fades when surfing again mid-burst', () => {
    const { result } = renderHook(() => useChannelSurf())

    act(() => {
      result.current.setNavigationSource('keyboard')
      result.current.triggerSurf(channel)
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    // Second trigger before the quiet period (300ms) elapsed
    act(() => {
      result.current.setNavigationSource('keyboard')
      result.current.triggerSurf(channel)
    })

    // The original fade timer was cleared: static must still be visible
    // at the first deadline (t=670) and only fade at the rescheduled one
    // (t=200 + 300 + 370 = 870).
    act(() => {
      vi.advanceTimersByTime(470)
    })
    expect(result.current.surfState.showStatic).toBe(true)

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.surfState.showStatic).toBe(false)
  })

  it('keeps static through the quiet period for surf navigation', () => {
    const { result } = renderHook(() => useChannelSurf())

    act(() => {
      result.current.setNavigationSource('surf')
      result.current.triggerSurf(channel)
    })
    expect(result.current.surfState.navigationSource).toBe('surf')

    // Surf skips the quiet period: static fades after the short 150ms burst
    act(() => {
      vi.advanceTimersByTime(149)
    })
    expect(result.current.surfState.showStatic).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.surfState.showStatic).toBe(false)

    // OSD lingers the short surf duration, then fades
    act(() => {
      vi.advanceTimersByTime(1000 - 150)
    })
    expect(result.current.surfState.showOsd).toBe(false)
  })
})
