import { Volume1, Volume2, VolumeX } from 'lucide-react'
import { trackVolumeChange } from '~/lib/datadog/rum'

const MONO = "'VT323', 'Courier New', monospace"
const GREEN = '#39ff14'

export interface VolumeControlProps {
  volume: number
  isMuted: boolean
  onVolumeChange: (v: number) => void
  onToggleMute: () => void
}

function VolumeIcon({ volume, isMuted }: { volume: number; isMuted: boolean }) {
  if (isMuted || volume === 0) return <VolumeX size={16} />
  if (volume < 50) return <Volume1 size={16} />
  return <Volume2 size={16} />
}

export function VolumeControl({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
}: VolumeControlProps) {
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = Number(e.target.value)
    onVolumeChange(newValue)

    // Smart mute interaction: dragging above 0 while muted auto-unmutes
    if (newValue > 0 && isMuted) {
      onToggleMute()
    }
    // Dragging to 0 while not muted auto-mutes
    if (newValue === 0 && !isMuted) {
      onToggleMute()
    }
  }

  const handleMouseUp = (): void => {
    trackVolumeChange(volume, 'slider')
  }

  const handleTouchEnd = (): void => {
    trackVolumeChange(volume, 'slider')
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontFamily: MONO,
      }}
    >
      {/* Mute toggle button */}
      <button
        type="button"
        onClick={() => {
          onToggleMute()
          trackVolumeChange(isMuted ? volume : 0, 'mute')
        }}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          color: isMuted ? 'rgba(255,165,0,0.9)' : 'rgba(255,255,255,0.6)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <VolumeIcon volume={volume} isMuted={isMuted} />
      </button>

      {/* Volume slider */}
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={volume}
        onChange={handleSliderChange}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleTouchEnd}
        aria-label="Volume"
        style={{
          width: '72px',
          height: '4px',
          cursor: 'pointer',
          opacity: isMuted ? 0.5 : 1,
          accentColor: GREEN,
        }}
      />

    </div>
  )
}
