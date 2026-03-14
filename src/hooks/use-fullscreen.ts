import { useCallback, useEffect, useState } from 'react'

export interface UseFullscreenResult {
  isFullscreen: boolean
  toggleFullscreen: () => void
}

export function useFullscreen(): UseFullscreenResult {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleChange = (): void => {
      setIsFullscreen(document.fullscreenElement !== null)
    }
    document.addEventListener('fullscreenchange', handleChange)
    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  const toggleFullscreen = useCallback((): void => {
    if (document.fullscreenElement !== null) {
      void document.exitFullscreen()
    } else {
      void document.documentElement.requestFullscreen()
    }
  }, [])

  return { isFullscreen, toggleFullscreen }
}
