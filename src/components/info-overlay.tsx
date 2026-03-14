import type { ChannelPreset } from '~/lib/channels/types'
import type { SchedulePosition } from '~/lib/scheduling/types'

export interface InfoOverlayProps {
  channel: ChannelPreset | null
  position: SchedulePosition | null
  visible: boolean
  nowMs: number
}

function formatTimeRemaining(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function computeSecondsRemaining(
  position: SchedulePosition,
  nowMs: number,
): number {
  return Math.max(
    0,
    Math.floor((position.slotEndTime.getTime() - nowMs) / 1000),
  )
}

export function InfoOverlay({
  channel,
  position,
  visible,
  nowMs,
}: InfoOverlayProps) {
  return (
    <div
      className="absolute bottom-4 left-4 z-30 transition-opacity duration-300"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
      aria-hidden={!visible}
      role="status"
    >
      <div className="bg-black/80 border border-amber-500/60 rounded px-4 py-3 font-mono min-w-[240px]">
        {channel !== null ? (
          <>
            <div className="text-amber-400 text-sm font-bold tracking-wider mb-1">
              CH {channel.number} — {channel.name.toUpperCase()}
            </div>

            {position !== null ? (
              <>
                <div className="text-zinc-100 text-xs truncate max-w-xs mb-2">
                  {position.video.title}
                </div>
                <div className="text-amber-300 text-xs tracking-widest">
                  {formatTimeRemaining(
                    computeSecondsRemaining(position, nowMs),
                  )}{' '}
                  remaining
                </div>
              </>
            ) : (
              <div className="text-zinc-500 text-xs">No program data</div>
            )}
          </>
        ) : (
          <div className="text-zinc-500 text-sm">No channel selected</div>
        )}
      </div>
    </div>
  )
}
