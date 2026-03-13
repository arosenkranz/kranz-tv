import type { ChannelPreset } from '~/lib/channels/types'
import type { SchedulePosition } from '~/lib/scheduling/types'

export interface ToolbarProps {
  channel: ChannelPreset | null
  position: SchedulePosition | null
  onToggleGuide: () => void
  onToggleMute: () => void
  onImport: () => void
  guideVisible: boolean
  isMuted: boolean
}

export function Toolbar({
  channel,
  position,
  onToggleGuide,
  onToggleMute,
  onImport,
  guideVisible,
  isMuted,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-4 bg-black/90 border-t border-zinc-800 px-4 py-2 font-mono">
      {/* Left: channel info */}
      <div className="flex-none min-w-[140px]">
        {channel !== null ? (
          <span className="text-amber-400 text-sm font-bold tracking-wide">
            CH {channel.number} — {channel.name.toUpperCase()}
          </span>
        ) : (
          <span className="text-zinc-600 text-sm">NO SIGNAL</span>
        )}
      </div>

      {/* Center: current video title */}
      <div className="flex-1 min-w-0 text-center">
        {position !== null ? (
          <span className="text-zinc-200 text-xs truncate block px-2">{position.video.title}</span>
        ) : (
          <span className="text-zinc-600 text-xs">—</span>
        )}
      </div>

      {/* Right: icon buttons + keyboard hints */}
      <div className="flex-none flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleGuide}
          className="text-zinc-400 hover:text-amber-400 transition-colors text-xs"
          aria-pressed={guideVisible}
          aria-label="Toggle guide"
          title="Toggle guide [G]"
        >
          {guideVisible ? '▣' : '▢'} GUIDE
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          className="text-zinc-400 hover:text-amber-400 transition-colors text-xs"
          aria-pressed={isMuted}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          title="Toggle mute [M]"
        >
          {isMuted ? '🔇' : '🔊'} MUTE
        </button>

        <button
          type="button"
          onClick={onImport}
          className="text-zinc-400 hover:text-amber-400 transition-colors text-xs"
          aria-label="Import channel"
          title="Import channel [I]"
        >
          ↑ IMPORT
        </button>

        <span className="text-zinc-600 text-xs hidden sm:inline">
          [G] Guide&nbsp;&nbsp;[M] Mute&nbsp;&nbsp;[I] Import&nbsp;&nbsp;[?] Help
        </span>
      </div>
    </div>
  )
}
