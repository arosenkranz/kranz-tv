import type { SchedulePosition } from '~/lib/scheduling/types'
import type { ChannelPreset } from '~/lib/channels/types'

const MONO = "'VT323', 'Courier New', monospace"

interface NowPlayingBarProps {
  position: SchedulePosition | null
  preset: ChannelPreset | undefined
  onToggleInfo: () => void
}

export function NowPlayingBar({
  position,
  preset,
  onToggleInfo,
}: NowPlayingBarProps) {
  const channelLabel = preset
    ? `CH ${String(preset.number).padStart(2, '0')} — ${preset.name.toUpperCase()}`
    : 'SELECT A CHANNEL'

  return (
    <button
      type="button"
      onClick={onToggleInfo}
      className="flex w-full items-center gap-3 border-y px-4 py-3 text-left"
      style={{
        borderColor: 'rgba(57,255,20,0.15)',
        backgroundColor: 'rgba(57,255,20,0.04)',
        minHeight: 56,
        WebkitTapHighlightColor: 'transparent',
      }}
      aria-label="Toggle info overlay"
    >
      <span
        className="shrink-0 font-mono text-base tracking-widest"
        style={{ color: '#39ff14', fontFamily: MONO }}
      >
        {channelLabel}
      </span>
      {position && (
        <span
          className="min-w-0 flex-1 truncate font-mono text-sm tracking-wider"
          style={{ color: 'rgba(255,165,0,0.85)', fontFamily: MONO }}
        >
          {position.video.title}
        </span>
      )}
    </button>
  )
}
