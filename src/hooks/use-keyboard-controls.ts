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
  onVolumeUp?: () => void
  onVolumeDown?: () => void
  onShare?: () => void
  onKeyMatched?: (key: string) => void
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
    onTheater,
    onVolumeUp,
    onVolumeDown,
    onShare,
    onKeyMatched,
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

      let matchedKey: string | null = null

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault()
          onChannelUp()
          matchedKey = 'ArrowUp'
          break
        case 'ArrowDown':
          event.preventDefault()
          onChannelDown()
          matchedKey = 'ArrowDown'
          break
        case 'g':
        case 'G':
          onToggleGuide()
          matchedKey = 'g'
          break
        case 'm':
        case 'M':
          onToggleMute()
          matchedKey = 'm'
          break
        case 'i':
        case 'I':
          onImport()
          matchedKey = 'i'
          break
        case 'n':
        case 'N':
          onInfo()
          matchedKey = 'n'
          break
        case 'h':
        case 'H':
          onHome()
          matchedKey = 'h'
          break
        case 'f':
        case 'F':
          onFullscreen()
          matchedKey = 'f'
          break
        case 'v':
        case 'V':
          onOverlay()
          matchedKey = 'v'
          break
        case 't':
        case 'T':
          onTheater?.()
          matchedKey = 't'
          break
        case '?':
          onHelp()
          matchedKey = '?'
          break
        case 'Escape':
          onEscape()
          matchedKey = 'Escape'
          break
        case '.':
          onVolumeUp?.()
          matchedKey = '.'
          break
        case ',':
          onVolumeDown?.()
          matchedKey = ','
          break
        case 's':
        case 'S':
          onShare?.()
          matchedKey = 's'
          break
      }

      if (matchedKey !== null) onKeyMatched?.(matchedKey)
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
    onTheater,
    onVolumeUp,
    onVolumeDown,
    onShare,
    onKeyMatched,
  ])
}
