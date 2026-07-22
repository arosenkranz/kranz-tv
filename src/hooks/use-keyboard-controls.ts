import { useEffect } from 'react'

export interface KeyboardControlsConfig {
  onChannelUp: () => void
  onChannelDown: () => void
  onToggleGuide: () => void
  onImport: () => void
  onHelp: () => void
  onEscape: () => void
  onHome: () => void
  onFullscreen: () => void
  onOverlay: () => void
  onTheater?: () => void
  onShare?: () => void
  onVisualizerCycle?: () => void
  onIntensityCycle?: () => void
  onKeyMatched?: (key: string) => void
}

export function useKeyboardControls(config: KeyboardControlsConfig): void {
  const {
    onChannelUp,
    onChannelDown,
    onToggleGuide,
    onImport,
    onHelp,
    onEscape,
    onHome,
    onFullscreen,
    onOverlay,
    onTheater,
    onShare,
    onVisualizerCycle,
    onIntensityCycle,
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
        case 'i':
        case 'I':
          onImport()
          matchedKey = 'i'
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
        case 'c':
        case 'C':
          onShare?.()
          matchedKey = 'c'
          break
        case 'n':
        case 'N':
          onVisualizerCycle?.()
          matchedKey = 'n'
          break
        case 'm':
        case 'M':
          onIntensityCycle?.()
          matchedKey = 'm'
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
    onImport,
    onHelp,
    onEscape,
    onHome,
    onFullscreen,
    onOverlay,
    onTheater,
    onShare,
    onVisualizerCycle,
    onIntensityCycle,
    onKeyMatched,
  ])
}
