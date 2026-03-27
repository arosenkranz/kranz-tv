import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIdleTimeout } from '~/hooks/use-idle-timeout'

describe('useIdleTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts not idle', () => {
    const { result } = renderHook(() => useIdleTimeout({ enabled: true }))
    expect(result.current.isIdle).toBe(false)
  })

  it('becomes idle after default 3000ms of no activity', () => {
    const { result } = renderHook(() => useIdleTimeout({ enabled: true }))
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.isIdle).toBe(true)
  })

  it('becomes idle after custom timeout', () => {
    const { result } = renderHook(() =>
      useIdleTimeout({ enabled: true, timeout: 1000 }),
    )
    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(result.current.isIdle).toBe(false)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.isIdle).toBe(true)
  })

  it('resets timer and stays active on mousemove', () => {
    const { result } = renderHook(() =>
      useIdleTimeout({ enabled: true, timeout: 1000 }),
    )
    act(() => {
      vi.advanceTimersByTime(800)
    })
    // Fire mousemove to reset
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'))
      vi.advanceTimersByTime(800)
    })
    expect(result.current.isIdle).toBe(false)
    // Let it fully expire
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.isIdle).toBe(true)
  })

  it('resets timer on touchstart', () => {
    const { result } = renderHook(() =>
      useIdleTimeout({ enabled: true, timeout: 1000 }),
    )
    act(() => {
      vi.advanceTimersByTime(800)
    })
    act(() => {
      window.dispatchEvent(new Event('touchstart'))
      vi.advanceTimersByTime(800)
    })
    expect(result.current.isIdle).toBe(false)
  })

  it('resets timer on keydown outside inputs', () => {
    const { result } = renderHook(() =>
      useIdleTimeout({ enabled: true, timeout: 1000 }),
    )
    act(() => {
      vi.advanceTimersByTime(800)
    })
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
      )
      vi.advanceTimersByTime(800)
    })
    expect(result.current.isIdle).toBe(false)
  })

  it('does NOT reset timer on keydown when focus is on an input element', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const { result } = renderHook(() =>
      useIdleTimeout({ enabled: true, timeout: 1000 }),
    )
    act(() => {
      vi.advanceTimersByTime(800)
    })
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
      )
      vi.advanceTimersByTime(300)
    })
    expect(result.current.isIdle).toBe(true)

    document.body.removeChild(input)
  })

  it('does not become idle when disabled', () => {
    const { result } = renderHook(() =>
      useIdleTimeout({ enabled: false, timeout: 100 }),
    )
    act(() => {
      vi.advanceTimersByTime(500)
    })
    // stays false — no timer was started
    expect(result.current.isIdle).toBe(false)
  })

  it('removes listeners and clears timer when enabled flips to false', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useIdleTimeout({ enabled, timeout: 1000 }),
      { initialProps: { enabled: true } },
    )

    const addCount = addSpy.mock.calls.length
    expect(addCount).toBeGreaterThan(0)

    act(() => {
      rerender({ enabled: false })
    })

    expect(removeSpy.mock.calls.length).toBeGreaterThanOrEqual(addCount)

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
