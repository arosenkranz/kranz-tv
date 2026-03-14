import { ChevronUp, ChevronDown } from 'lucide-react'

const MONO = "'VT323', 'Courier New', monospace"

interface ChannelButtonProps {
  direction: 'up' | 'down'
  onPress: () => void
}

export function ChannelButton({ direction, onPress }: ChannelButtonProps) {
  const handleTouch = (e: React.TouchEvent): void => {
    e.preventDefault()
    navigator.vibrate?.(10)
    onPress()
  }

  return (
    <button
      type="button"
      onTouchStart={handleTouch}
      onClick={onPress}
      className="control-press flex w-full items-center justify-center gap-2 rounded border"
      style={{
        height: '64px',
        backgroundColor: 'rgba(57,255,20,0.05)',
        borderColor: 'rgba(57,255,20,0.2)',
        color: '#39ff14',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
      }}
      aria-label={direction === 'up' ? 'Channel up' : 'Channel down'}
    >
      {direction === 'up' ? <ChevronUp size={28} /> : <ChevronDown size={28} />}
      <span
        className="font-mono text-lg tracking-widest"
        style={{ fontFamily: MONO }}
      >
        CH {direction.toUpperCase()}
      </span>
    </button>
  )
}
