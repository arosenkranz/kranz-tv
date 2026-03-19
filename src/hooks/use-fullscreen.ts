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

export function useFullscreen(): UseFullscreenResult {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
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
  }, [])

  return { isFullscreen, toggleFullscreen }
}
