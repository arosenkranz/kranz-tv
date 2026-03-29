import { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { MobileGuideRow } from '~/components/mobile/mobile-guide-row'
import { MONO_FONT } from '~/lib/theme'
import type { ChannelPreset } from '~/lib/channels/types'
import type { Channel } from '~/lib/scheduling/types'

interface MobileGuideSheetProps {
  readonly isOpen: boolean
  readonly onOpen: () => void
  readonly onClose: () => void
  readonly onChannelSelect: (id: string) => void
  readonly allPresets: ChannelPreset[]
  readonly loadedChannels: Map<string, Channel>
  readonly currentChannelId: string
}

const EXPANDED_Y = 20 // % from top when fully open
const COLLAPSED_Y = 100 // % from top when closed

export function MobileGuideSheet({
  isOpen,
  onOpen,
  onClose,
  onChannelSelect,
  allPresets,
  loadedChannels,
  currentChannelId,
}: MobileGuideSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartYRef = useRef<number | null>(null)
  const dragStartTranslateRef = useRef(COLLAPSED_Y)
  const [translateY, setTranslateY] = useState(COLLAPSED_Y)
  const [isDragging, setIsDragging] = useState(false)

  // Animate to target when isOpen changes
  useEffect(() => {
    setTranslateY(isOpen ? EXPANDED_Y : COLLAPSED_Y)
  }, [isOpen])

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      dragStartYRef.current = e.touches[0].clientY
      dragStartTranslateRef.current = translateY
      setIsDragging(true)
    },
    [translateY],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (dragStartYRef.current === null) return
      const deltaY = e.touches[0].clientY - dragStartYRef.current
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const deltaPct = (deltaY / viewportHeight) * 100
      const newY = Math.max(
        EXPANDED_Y,
        Math.min(COLLAPSED_Y, dragStartTranslateRef.current + deltaPct),
      )
      setTranslateY(newY)
    },
    [],
  )

  const handleTouchEnd = useCallback(() => {
    dragStartYRef.current = null
    setIsDragging(false)

    // Snap to nearest breakpoint
    const midpoint = (EXPANDED_Y + COLLAPSED_Y) / 2
    if (translateY > midpoint) {
      setTranslateY(COLLAPSED_Y)
      onClose()
    } else {
      setTranslateY(EXPANDED_Y)
    }
  }, [translateY, onClose])

  const handleChannelSelect = useCallback(
    (id: string) => {
      onChannelSelect(id)
      setTranslateY(COLLAPSED_Y)
      onClose()
    },
    [onChannelSelect, onClose],
  )

  const isVisible = translateY < COLLAPSED_Y

  return (
    <>
      {/* Backdrop */}
      {isVisible && (
        <div
          className="fixed inset-0 z-40"
          style={{
            backgroundColor: `rgba(0,0,0,${0.6 * (1 - (translateY - EXPANDED_Y) / (COLLAPSED_Y - EXPANDED_Y))})`,
          }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Peek bar — always visible at bottom when sheet is collapsed */}
      {!isVisible && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 flex flex-col items-center"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
            backgroundColor: '#0a0a0a',
            borderTop: '1px solid rgba(57,255,20,0.15)',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            onClick={onOpen}
            className="flex flex-col items-center gap-0.5 py-2 px-8 touch-none"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            aria-label="Open program guide"
          >
            <ChevronUp size={16} style={{ color: 'rgba(57,255,20,0.5)' }} />
            <div
              className="rounded-full"
              style={{
                width: 48,
                height: 5,
                backgroundColor: 'rgba(57,255,20,0.5)',
              }}
            />
            <span
              className="font-mono text-xs tracking-widest uppercase"
              style={{
                color: 'rgba(57,255,20,0.45)',
                fontFamily: MONO_FONT,
                fontSize: '10px',
              }}
            >
              GUIDE
            </span>
          </button>
        </div>
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl"
        style={{
          top: 0,
          transform: `translateY(${translateY}%)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          backgroundColor: '#0a0a0a',
          maxHeight: '100dvh',
        }}
      >
        {/* Drag handle */}
        <div
          className="flex flex-col items-center gap-0.5 py-3 touch-none cursor-grab"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {isOpen ? (
            <ChevronDown size={16} style={{ color: 'rgba(57,255,20,0.5)' }} />
          ) : (
            <ChevronUp size={16} style={{ color: 'rgba(57,255,20,0.5)' }} />
          )}
          <div
            className="rounded-full"
            style={{
              width: 48,
              height: 5,
              backgroundColor: 'rgba(57,255,20,0.5)',
            }}
          />
          <span
            className="font-mono tracking-widest uppercase"
            style={{
              color: 'rgba(57,255,20,0.45)',
              fontFamily: MONO_FONT,
              fontSize: '10px',
            }}
          >
            PROGRAM GUIDE
          </span>
        </div>

        {/* Channel list */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
          }}
        >
          {allPresets.map((preset) => (
            <MobileGuideRow
              key={preset.id}
              preset={preset}
              loadedChannel={loadedChannels.get(preset.id)}
              isActive={preset.id === currentChannelId}
              onSelect={handleChannelSelect}
            />
          ))}
        </div>
      </div>
    </>
  )
}
