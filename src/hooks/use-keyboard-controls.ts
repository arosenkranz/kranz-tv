import { useEffect } from 'react'

export interface KeyboardControlsConfig {
  onChannelUp: () => void
  onChannelDown: () => void
  onToggleGuide: () => void
  onToggleMute: () => void
  onImport: () => void
  onInfo: () => void
  onHelp: () => void
  onEscape: () => void
  onHome: () => void
  onFullscreen: () => void
  onOverlay: () => void
  onTheater?: () => void
}

export function useKeyboardControls(config: KeyboardControlsConfig): void {
  const {
    onChannelUp,
    onChannelDown,
    onToggleGuide,
    onToggleMute,
    onImport,
    onInfo,
    onHelp,
    onEscape,
    onHome,
    onFullscreen,
    onOverlay,
  } = config

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Skip when user is typing in an input, textarea, or select
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault()
          onChannelUp()
          break
        case 'ArrowDown':
          event.preventDefault()
          onChannelDown()
          break
        case 'g':
        case 'G':
          onToggleGuide()
          break
        case 'm':
        case 'M':
          onToggleMute()
          break
        case 'i':
        case 'I':
          onImport()
          break
        case 'n':
        case 'N':
          onInfo()
          break
        case 'h':
        case 'H':
          onHome()
          break
        case 'f':
        case 'F':
          onFullscreen()
          break
        case 'v':
        case 'V':
          onOverlay()
          break
        case '?':
          onHelp()
          break
        case 'Escape':
          onEscape()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    onChannelUp,
    onChannelDown,
    onToggleGuide,
    onToggleMute,
    onImport,
    onInfo,
    onHelp,
    onEscape,
    onHome,
    onFullscreen,
    onOverlay,
  ])
}
