import { useState, useEffect, useRef } from 'react'

export interface UseIdleTimeoutConfig {
  timeout?: number
  enabled: boolean
}

export interface IdleState {
  isIdle: boolean
}

export function useIdleTimeout({
  timeout = 3000,
  enabled,
}: UseIdleTimeoutConfig): IdleState {
  const [isIdle, setIsIdle] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Throttle ref: tracks last mousemove handler time to avoid excessive resets
  const lastMoveRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      setIsIdle(false)
      return
    }

    const resetTimer = (): void => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      setIsIdle(false)
      timerRef.current = setTimeout(() => setIsIdle(true), timeout)
    }

    const handleMouseMove = (): void => {
      const now = Date.now()
      if (now - lastMoveRef.current < 200) return
      lastMoveRef.current = now
      resetTimer()
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }
      resetTimer()
    }

    const handleTouch = (): void => {
      resetTimer()
    }

    // Start the initial idle timer
    resetTimer()

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('touchstart', handleTouch)

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('touchstart', handleTouch)
    }
  }, [enabled, timeout])

  return { isIdle }
}
