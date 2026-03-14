import { useEffect, useRef } from 'react'
import type { ChannelPreset } from '~/lib/channels/types'
import type { Channel } from '~/lib/scheduling/types'
import { MobileGuideRow } from '~/components/remote-control/mobile-guide-row'

const MONO = "'VT323', 'Courier New', monospace"

interface MobileGuideProps {
  visible: boolean
  allPresets: ChannelPreset[]
  loadedChannels: Map<string, Channel>
  currentChannelId: string
  onChannelSelect: (id: string) => void
  onClose: () => void
}

export function MobileGuide({
  visible,
  allPresets,
  loadedChannels,
  currentChannelId,
  onChannelSelect,
  onClose,
}: MobileGuideProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  // Prevent body scroll when guide is open
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [visible])

  if (!visible) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === backdropRef.current) onClose()
  }

  const handleSelect = (id: string): void => {
    onChannelSelect(id)
    onClose()
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Channel guide"
    >
      <div
        className="relative flex w-full flex-col rounded-t-2xl"
        style={{
          height: '70vh',
          backgroundColor: '#0a0a0a',
          border: '1px solid rgba(57,255,20,0.2)',
          borderBottom: 'none',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div
            className="rounded-full"
            style={{
              width: 40,
              height: 4,
              backgroundColor: 'rgba(255,255,255,0.2)',
            }}
          />
        </div>

        {/* Header */}
        <div
          className="shrink-0 flex items-center justify-between border-b px-4 pb-3"
          style={{ borderColor: 'rgba(57,255,20,0.15)' }}
        >
          <span
            className="font-mono text-lg tracking-widest uppercase"
            style={{ color: '#39ff14', fontFamily: MONO }}
          >
            TV GUIDE
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-2xl"
            style={{ color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}
            aria-label="Close guide"
          >
            ✕
          </button>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto remote-panel">
          <div
            className="divide-y"
            style={{ borderColor: 'rgba(57,255,20,0.06)' }}
          >
            {allPresets.map((preset) => (
              <MobileGuideRow
                key={preset.id}
                preset={preset}
                loadedChannel={loadedChannels.get(preset.id)}
                isActive={preset.id === currentChannelId}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
