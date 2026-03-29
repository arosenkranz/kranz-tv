import { useEffect, useRef } from 'react'

type SwipeDirection = 'up' | 'down'

interface SwipeOptions {
  readonly threshold?: number
  readonly debounceMs?: number
  readonly onSwipe: (direction: SwipeDirection) => void
}

export function useSwipeGesture(
  ref: React.RefObject<HTMLElement | null>,
  { threshold = 50, debounceMs = 400, onSwipe }: SwipeOptions,
): void {
  const startYRef = useRef<number | null>(null)
  const lastFireRef = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleTouchStart = (e: TouchEvent): void => {
      startYRef.current = e.touches[0].clientY
    }

    const handleTouchEnd = (e: TouchEvent): void => {
      if (startYRef.current === null) return

      const deltaY = startYRef.current - e.changedTouches[0].clientY
      startYRef.current = null

      if (Math.abs(deltaY) < threshold) return

      const now = Date.now()
      if (now - lastFireRef.current < debounceMs) return
      lastFireRef.current = now

      onSwipe(deltaY > 0 ? 'up' : 'down')
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [ref, threshold, debounceMs, onSwipe])
}
