import type { LucideIcon } from 'lucide-react'

const MONO = "'VT323', 'Courier New', monospace"

interface ControlButtonProps {
  icon: LucideIcon
  label: string
  isActive?: boolean
  onPress: () => void
  size?: 'sm' | 'md' | 'lg'
}

export function ControlButton({
  icon: Icon,
  label,
  isActive = false,
  onPress,
  size = 'md',
}: ControlButtonProps) {
  const dim = size === 'lg' ? 80 : size === 'sm' ? 48 : 56
  const iconSize = size === 'lg' ? 28 : size === 'sm' ? 18 : 22

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
      className="control-press flex flex-col items-center justify-center gap-1 rounded-full border"
      style={{
        width: dim,
        height: dim,
        minWidth: 48,
        minHeight: 48,
        backgroundColor: isActive ? 'rgba(57,255,20,0.12)' : 'rgba(0,0,0,0.4)',
        borderColor: isActive
          ? 'rgba(57,255,20,0.6)'
          : 'rgba(255,255,255,0.15)',
        color: isActive ? '#39ff14' : 'rgba(255,255,255,0.7)',
        boxShadow: isActive
          ? '0 0 12px rgba(57,255,20,0.3)'
          : 'none',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
      }}
      aria-label={label}
      aria-pressed={isActive}
    >
      <Icon size={iconSize} />
      <span
        className="font-mono tracking-widest"
        style={{
          fontSize: '9px',
          fontFamily: MONO,
          opacity: 0.8,
        }}
      >
        {label.toUpperCase()}
      </span>
    </button>
  )
}
