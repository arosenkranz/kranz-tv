import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSwipeGesture } from './use-swipe-gesture'

function createTouchEvent(type: string, clientY: number): TouchEvent {
  const touch = { clientY } as Touch
  return new TouchEvent(type, {
    [type === 'touchstart' ? 'touches' : 'changedTouches']: [touch],
  })
}

describe('useSwipeGesture', () => {
  let el: HTMLDivElement
  let onSwipe: ReturnType<typeof vi.fn>

  beforeEach(() => {
    el = document.createElement('div')
    document.body.appendChild(el)
    onSwipe = vi.fn()
  })

  it('fires "up" when swiped upward past threshold', () => {
    const ref = { current: el }
    renderHook(() => useSwipeGesture(ref, { threshold: 50, onSwipe }))

    el.dispatchEvent(createTouchEvent('touchstart', 300))
    el.dispatchEvent(createTouchEvent('touchend', 200))

    expect(onSwipe).toHaveBeenCalledWith('up')
  })

  it('fires "down" when swiped downward past threshold', () => {
    const ref = { current: el }
    renderHook(() => useSwipeGesture(ref, { threshold: 50, onSwipe }))

    el.dispatchEvent(createTouchEvent('touchstart', 200))
    el.dispatchEvent(createTouchEvent('touchend', 300))

    expect(onSwipe).toHaveBeenCalledWith('down')
  })

  it('does not fire when delta is below threshold', () => {
    const ref = { current: el }
    renderHook(() => useSwipeGesture(ref, { threshold: 50, onSwipe }))

    el.dispatchEvent(createTouchEvent('touchstart', 300))
    el.dispatchEvent(createTouchEvent('touchend', 270))

    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('debounces rapid swipes', () => {
    vi.useFakeTimers()
    const ref = { current: el }
    renderHook(() =>
      useSwipeGesture(ref, { threshold: 50, debounceMs: 400, onSwipe }),
    )

    // First swipe — should fire
    el.dispatchEvent(createTouchEvent('touchstart', 300))
    el.dispatchEvent(createTouchEvent('touchend', 200))

    // Second swipe immediately — should be debounced
    el.dispatchEvent(createTouchEvent('touchstart', 300))
    el.dispatchEvent(createTouchEvent('touchend', 200))

    expect(onSwipe).toHaveBeenCalledTimes(1)

    // After debounce period — should fire again
    vi.advanceTimersByTime(401)
    el.dispatchEvent(createTouchEvent('touchstart', 300))
    el.dispatchEvent(createTouchEvent('touchend', 200))

    expect(onSwipe).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('does nothing when ref is null', () => {
    const ref = { current: null }
    renderHook(() => useSwipeGesture(ref, { threshold: 50, onSwipe }))
    expect(onSwipe).not.toHaveBeenCalled()
  })
})
