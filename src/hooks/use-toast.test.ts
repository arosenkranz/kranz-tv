import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from '~/hooks/use-toast'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts not visible with empty message', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.visible).toBe(false)
    expect(result.current.message).toBe('')
    expect(result.current.detail).toBeUndefined()
  })

  it('becomes visible when show is called', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.show('LINK COPIED')
    })
    expect(result.current.visible).toBe(true)
    expect(result.current.message).toBe('LINK COPIED')
  })

  it('sets detail when provided', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.show('LINK COPIED', 'https://kranz.tv/channel/nature')
    })
    expect(result.current.detail).toBe('https://kranz.tv/channel/nature')
  })

  it('auto-dismisses after default 2000ms', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.show('LINK COPIED')
    })
    expect(result.current.visible).toBe(true)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.visible).toBe(false)
  })

  it('auto-dismisses after custom durationMs', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.show('COPY FAILED', undefined, 3000)
    })
    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(result.current.visible).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.visible).toBe(false)
  })

  it('replaces the current toast when show is called again', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.show('LINK COPIED')
    })
    act(() => {
      result.current.show('COPY FAILED')
    })
    expect(result.current.message).toBe('COPY FAILED')
    expect(result.current.visible).toBe(true)
  })

  it('resets the timer when show is called again before auto-dismiss', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.show('LINK COPIED')
    })
    // 1.5s later — call show again; timer should reset
    act(() => {
      vi.advanceTimersByTime(1500)
      result.current.show('LINK COPIED')
    })
    // Another 1.5s — should still be visible (2s hasn't elapsed since last show)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(result.current.visible).toBe(true)

    // Complete 2s from last show call
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.visible).toBe(false)
  })

  it('clears detail when new show omits it', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.show('FIRST', 'detail text')
    })
    act(() => {
      result.current.show('SECOND')
    })
    expect(result.current.detail).toBeUndefined()
  })
})
