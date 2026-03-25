import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVolumeOsd } from '~/hooks/use-volume-osd'

describe('useVolumeOsd', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts not visible on first render', () => {
    const { result } = renderHook(() => useVolumeOsd(80, false))
    expect(result.current.visible).toBe(false)
  })

  it('does not show OSD on initial render (skip-first-render guard)', () => {
    const { result } = renderHook(() => useVolumeOsd(80, false))
    // No act/state change — just initial render
    expect(result.current.visible).toBe(false)
  })

  it('becomes visible when volume changes', () => {
    const { result, rerender } = renderHook(
      ({ volume, isMuted }: { volume: number; isMuted: boolean }) =>
        useVolumeOsd(volume, isMuted),
      { initialProps: { volume: 80, isMuted: false } },
    )

    expect(result.current.visible).toBe(false)

    act(() => {
      rerender({ volume: 70, isMuted: false })
    })

    expect(result.current.visible).toBe(true)
  })

  it('becomes visible when isMuted changes', () => {
    const { result, rerender } = renderHook(
      ({ volume, isMuted }: { volume: number; isMuted: boolean }) =>
        useVolumeOsd(volume, isMuted),
      { initialProps: { volume: 80, isMuted: false } },
    )

    act(() => {
      rerender({ volume: 80, isMuted: true })
    })

    expect(result.current.visible).toBe(true)
  })

  it('hides automatically after 2000ms', () => {
    const { result, rerender } = renderHook(
      ({ volume, isMuted }: { volume: number; isMuted: boolean }) =>
        useVolumeOsd(volume, isMuted),
      { initialProps: { volume: 80, isMuted: false } },
    )

    act(() => {
      rerender({ volume: 70, isMuted: false })
    })

    expect(result.current.visible).toBe(true)

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.visible).toBe(false)
  })

  it('resets the 2s timer on each successive change', () => {
    const { result, rerender } = renderHook(
      ({ volume, isMuted }: { volume: number; isMuted: boolean }) =>
        useVolumeOsd(volume, isMuted),
      { initialProps: { volume: 80, isMuted: false } },
    )

    act(() => {
      rerender({ volume: 70, isMuted: false })
    })

    // 1.5s later — another volume change; timer should reset
    act(() => {
      vi.advanceTimersByTime(1500)
      rerender({ volume: 60, isMuted: false })
    })

    // Another 1.5s — should still be visible (2s hasn't elapsed since last change)
    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(result.current.visible).toBe(true)

    // Complete 2s from last change
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current.visible).toBe(false)
  })

  it('returns displayVolume equal to the current volume', () => {
    const { result, rerender } = renderHook(
      ({ volume, isMuted }: { volume: number; isMuted: boolean }) =>
        useVolumeOsd(volume, isMuted),
      { initialProps: { volume: 80, isMuted: false } },
    )

    act(() => {
      rerender({ volume: 60, isMuted: false })
    })

    expect(result.current.displayVolume).toBe(60)
  })

  it('returns displayMuted reflecting current muted state', () => {
    const { result, rerender } = renderHook(
      ({ volume, isMuted }: { volume: number; isMuted: boolean }) =>
        useVolumeOsd(volume, isMuted),
      { initialProps: { volume: 80, isMuted: false } },
    )

    act(() => {
      rerender({ volume: 80, isMuted: true })
    })

    expect(result.current.displayMuted).toBe(true)
  })
})
