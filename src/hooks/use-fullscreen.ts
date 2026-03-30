import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseFullscreenResult {
  isFullscreen: boolean
  toggleFullscreen: () => void
}

// Extend Document type for webkit prefixed fullscreen API
interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}
interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>
}

function isNativeFullscreen(): boolean {
  const doc = document as WebkitDocument
  return (
    document.fullscreenElement !== null ||
    (doc.webkitFullscreenElement ?? null) !== null
  )
}

export function useFullscreen(): UseFullscreenResult {
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Track whether we're in CSS pseudo-fullscreen (iOS/iPadOS fallback)
  const isPseudoRef = useRef(false)

  useEffect(() => {
    const handleChange = (): void => {
      setIsFullscreen(isNativeFullscreen())
    }
    document.addEventListener('fullscreenchange', handleChange)
    document.addEventListener('webkitfullscreenchange', handleChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
      document.removeEventListener('webkitfullscreenchange', handleChange)
    }
  }, [])

  const toggleFullscreen = useCallback((): void => {
    // Exit from native fullscreen
    if (isNativeFullscreen()) {
      const doc = document as WebkitDocument
      void document.exitFullscreen().catch(() => doc.webkitExitFullscreen?.())
      return
    }

    // Exit from pseudo-fullscreen
    if (isPseudoRef.current) {
      isPseudoRef.current = false
      setIsFullscreen(false)
      return
    }

    // Enter: try native first, fall back to pseudo-fullscreen.
    // On iPadOS, requestFullscreen exists but silently rejects for
    // non-<video> elements. On iPhone Safari it doesn't exist at all.
    const el = document.documentElement as WebkitElement
    const nativeRequest =
      typeof el.requestFullscreen === 'function'
        ? el.requestFullscreen()
        : typeof el.webkitRequestFullscreen === 'function'
          ? el.webkitRequestFullscreen()
          : null

    if (nativeRequest !== null) {
      void nativeRequest.catch(() => {
        // Native rejected (iPadOS) — use pseudo-fullscreen
        isPseudoRef.current = true
        setIsFullscreen(true)
      })
    } else {
      // No native API (iPhone Safari) — use pseudo-fullscreen
      isPseudoRef.current = true
      setIsFullscreen(true)
    }
  }, [])

  return { isFullscreen, toggleFullscreen }
}
