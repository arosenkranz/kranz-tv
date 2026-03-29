import { useCallback, useEffect, useState } from 'react'

export interface UseFullscreenResult {
  isFullscreen: boolean
  toggleFullscreen: () => void
}

// Extend Document type for webkit prefixed fullscreen API (iOS Safari)
interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}
interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>
}

/**
 * Detect whether the standard Fullscreen API is available.
 * iOS Safari does NOT support requestFullscreen on arbitrary elements —
 * only <video> elements via webkitEnterFullscreen. Since we use a YouTube
 * IFrame, we fall back to a CSS-based pseudo-fullscreen on iOS.
 */
function hasNativeFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  return (
    typeof document.documentElement.requestFullscreen === 'function' ||
    typeof (document.documentElement as WebkitElement).webkitRequestFullscreen ===
      'function'
  )
}

export function useFullscreen(): UseFullscreenResult {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (!hasNativeFullscreen()) {
      // No native fullscreen — state is managed entirely via toggleFullscreen
      return
    }

    const handleChange = (): void => {
      const doc = document as WebkitDocument
      setIsFullscreen(
        document.fullscreenElement !== null ||
          (doc.webkitFullscreenElement ?? null) !== null,
      )
    }
    document.addEventListener('fullscreenchange', handleChange)
    document.addEventListener('webkitfullscreenchange', handleChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
      document.removeEventListener('webkitfullscreenchange', handleChange)
    }
  }, [])

  const toggleFullscreen = useCallback((): void => {
    if (hasNativeFullscreen()) {
      // Standard path: Chrome, Firefox, desktop Safari, Android
      const doc = document as WebkitDocument
      const el = document.documentElement as WebkitElement
      const isCurrentlyFullscreen =
        document.fullscreenElement !== null ||
        (doc.webkitFullscreenElement ?? null) !== null

      if (isCurrentlyFullscreen) {
        void document.exitFullscreen().catch(() => doc.webkitExitFullscreen?.())
      } else {
        void el.requestFullscreen().catch(() => el.webkitRequestFullscreen?.())
      }
    } else {
      // iOS Safari fallback: toggle CSS pseudo-fullscreen
      setIsFullscreen((prev) => !prev)
    }
  }, [])

  return { isFullscreen, toggleFullscreen }
}
