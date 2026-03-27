import { useState, useEffect } from 'react'

export interface EpgNavigationOptions {
  isOpen: boolean
  channelCount: number
  initialIndex: number
  onSelect: (index: number) => void
  onClose: () => void
  /** When false, skip the capture-phase keyboard listener (inline mode: mouse-only navigation) */
  captureKeys?: boolean
}

export interface EpgNavigationResult {
  cursorIndex: number
  setCursorIndex: (index: number) => void
}

/**
 * Manages cursor state and keyboard capture for the EPG overlay.
 *
 * Registers a capture-phase listener so arrow keys, Enter, Escape, and G
 * are intercepted before useKeyboardControls (bubble phase) fires.
 */
export function useEpgNavigation({
  isOpen,
  channelCount,
  initialIndex,
  onSelect,
  onClose,
  captureKeys = true,
}: EpgNavigationOptions): EpgNavigationResult {
  const [cursorIndex, setCursorIndex] = useState(initialIndex)

  // Reset cursor to current channel whenever overlay opens
  useEffect(() => {
    if (isOpen) {
      setCursorIndex(initialIndex)
    }
  }, [isOpen, initialIndex])

  useEffect(() => {
    if (!isOpen || !captureKeys) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowUp') {
        e.stopPropagation()
        e.preventDefault()
        setCursorIndex((prev) => (prev <= 0 ? channelCount - 1 : prev - 1))
      } else if (e.key === 'ArrowDown') {
        e.stopPropagation()
        e.preventDefault()
        setCursorIndex((prev) => (prev >= channelCount - 1 ? 0 : prev + 1))
      } else if (e.key === 'Enter') {
        e.stopPropagation()
        e.preventDefault()
        onSelect(cursorIndex)
        onClose()
      } else if (e.key === 'Escape' || e.key === 'g' || e.key === 'G') {
        e.stopPropagation()
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () =>
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isOpen, captureKeys, channelCount, cursorIndex, onSelect, onClose])

  return { cursorIndex, setCursorIndex }
}
