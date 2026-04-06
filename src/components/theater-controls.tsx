import { ChevronUp, ChevronDown, LayoutGrid, Shuffle, Tv } from 'lucide-react'
import { useEffect } from 'react'
import { VolumeControl } from '~/components/volume-control'

const MONO = "'VT323', 'Courier New', monospace"
const GREEN = '#39ff14'
const ORANGE = '#ffa500'

export interface TheaterControlsProps {
  visible: boolean
  channelNumber: number | null
  channelName: string | null
  onChannelUp: () => void
  onChannelDown: () => void
  onToggleGuide: () => void
  onCycleOverlay: () => void
  onExitTheater: () => void
  volume: number
  isMuted: boolean
  onVolumeChange: (v: number) => void
  onToggleMute: () => void
  onShare?: () => void
  onSurfToggle?: () => void
  isSurfing?: boolean
}

export function TheaterControls({
  visible,
  channelNumber,
  channelName,
  onChannelUp,
  onChannelDown,
  onToggleGuide,
  onCycleOverlay,
  onExitTheater,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  onShare,
  onSurfToggle,
  isSurfing = false,
}: TheaterControlsProps) {
  // Manage cursor visibility: hide when controls are hidden (idle), show when visible
  useEffect(() => {
    document.body.style.cursor = visible ? 'auto' : 'none'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [visible])

  const channelLabel =
    channelNumber !== null && channelName !== null
      ? `CH ${String(channelNumber).padStart(2, '0')} — ${channelName.toUpperCase()}`
      : '— SELECT A CHANNEL'

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[9997]"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease',
      }}
      aria-hidden={!visible}
    >
      <div
        className="pointer-events-auto flex items-center gap-4 px-6 py-4"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.0) 100%)',
          fontFamily: MONO,
        }}
      >
        {/* Channel label */}
        <span
          className="font-mono text-xl tracking-widest"
          style={{ color: ORANGE }}
        >
          {channelLabel}
        </span>

        {/* Channel nav */}
        <div className="flex flex-col" style={{ gap: '0' }}>
          <button
            type="button"
            onClick={onChannelUp}
            aria-label="Channel up"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: GREEN,
              padding: '0 2px',
              lineHeight: 1,
            }}
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={onChannelDown}
            aria-label="Channel down"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: GREEN,
              padding: '0 2px',
              lineHeight: 1,
            }}
          >
            <ChevronDown size={14} />
          </button>
        </div>

        {/* Volume */}
        <VolumeControl
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={onVolumeChange}
          onToggleMute={onToggleMute}
        />

        {/* Action buttons */}
        <span
          className="ml-auto flex items-center gap-4 font-mono text-sm tracking-wider"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          <button
            type="button"
            onClick={onToggleGuide}
            title="Guide [G]"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>[G]</span> <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            onClick={onSurfToggle}
            title="Surf [S]"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isSurfing ? GREEN : 'rgba(255,255,255,0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Shuffle size={14} /> [S] {isSurfing ? 'SURFING' : 'SURF'}
          </button>
          <button
            type="button"
            onClick={onShare}
            title="Share [C]"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            [C] SHARE
          </button>
          <button
            type="button"
            onClick={onCycleOverlay}
            title="Overlay [V]"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            [V] OVERLAY
          </button>
          <button
            type="button"
            onClick={onExitTheater}
            title="Exit theater [T]"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Tv size={14} /> [T] EXIT
          </button>
        </span>
      </div>
    </div>
  )
}
