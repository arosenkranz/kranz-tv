import { useRef, useState, useEffect, useCallback } from 'react'
import { MobileGuideRow } from '~/components/mobile/mobile-guide-row'
import type { ChannelPreset } from '~/lib/channels/types'
import type { Channel } from '~/lib/scheduling/types'

interface MobileGuideSheetProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onChannelSelect: (id: string) => void
  readonly allPresets: ChannelPreset[]
  readonly loadedChannels: Map<string, Channel>
  readonly currentChannelId: string
}

const EXPANDED_Y = 20 // % from top when fully open
const COLLAPSED_Y = 100 // % from top when closed
const SNAP_THRESHOLD = 50 // % — if dragged past this, snap to other state

export function MobileGuideSheet({
  isOpen,
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
      const deltaPct = (deltaY / window.innerHeight) * 100
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

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl"
        style={{
          top: 0,
          transform: `translateY(${translateY}%)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          backgroundColor: '#0a0a0a',
          maxHeight: '100vh',
        }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center py-3 touch-none cursor-grab"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="rounded-full"
            style={{
              width: 36,
              height: 4,
              backgroundColor: 'rgba(57,255,20,0.3)',
            }}
          />
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-safe">
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
