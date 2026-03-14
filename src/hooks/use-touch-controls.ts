import { useEffect, useRef } from 'react'
import type { KeyboardControlsConfig } from '~/hooks/use-keyboard-controls'

type TouchControlsConfig = Pick<
  KeyboardControlsConfig,
  'onChannelUp' | 'onChannelDown' | 'onToggleGuide' | 'onToggleMute'
>

const MIN_SWIPE_DISTANCE = 50
const MAX_SWIPE_DURATION_MS = 300

export function useTouchControls(
  ref: React.RefObject<HTMLElement | null>,
  config: TouchControlsConfig,
): void {
  const { onChannelUp, onChannelDown, onToggleGuide, onToggleMute } = config
  const startX = useRef(0)
  const startY = useRef(0)
  const startTime = useRef(0)
  const lastTapTime = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    el.style.touchAction = 'none'

    const handleTouchStart = (e: TouchEvent): void => {
      const touch = e.touches[0]
      startX.current = touch.clientX
      startY.current = touch.clientY
      startTime.current = Date.now()
    }

    const handleTouchEnd = (e: TouchEvent): void => {
      const touch = e.changedTouches[0]
      const dx = touch.clientX - startX.current
      const dy = touch.clientY - startY.current
      const dt = Date.now() - startTime.current
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      // Double tap → toggle mute
      if (absDx < 10 && absDy < 10 && dt < 250) {
        const now = Date.now()
        if (now - lastTapTime.current < 400) {
          onToggleMute()
          lastTapTime.current = 0
          return
        }
        lastTapTime.current = now
        return
      }

      if (dt > MAX_SWIPE_DURATION_MS) return

      const isHorizontal = absDx > absDy
      const dist = isHorizontal ? absDx : absDy

      if (dist < MIN_SWIPE_DISTANCE) return

      if (isHorizontal) {
        if (dx < 0) {
          onToggleGuide() // swipe left → open guide
        } else {
          onToggleGuide() // swipe right → close guide
        }
      } else {
        if (dy < 0) {
          onChannelUp() // swipe up → channel up
        } else {
          onChannelDown() // swipe down → channel down
        }
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
      el.style.touchAction = ''
    }
  }, [onChannelUp, onChannelDown, onToggleGuide, onToggleMute, ref])
}
