import { useRef, useCallback } from 'react'
import { ChannelBadge } from '~/components/channel-badge'
import { useSwipeGesture } from '~/hooks/use-swipe-gesture'
import { MONO_FONT } from '~/lib/theme'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'

interface MobileNowNextBarProps {
  readonly channel: Channel
  readonly position: SchedulePosition
  readonly onTap: () => void
  readonly onSwipeUp: () => void
  readonly onSwipeDown: () => void
}

export function MobileNowNextBar({
  channel,
  position,
  onTap,
  onSwipeUp,
  onSwipeDown,
}: MobileNowNextBarProps) {
  const barRef = useRef<HTMLButtonElement>(null)

  const handleSwipe = useCallback(
    (direction: 'up' | 'down') => {
      if (direction === 'up') onSwipeUp()
      else onSwipeDown()
    },
    [onSwipeUp, onSwipeDown],
  )

  useSwipeGesture(barRef, { threshold: 40, onSwipe: handleSwipe })

  const elapsed = position.seekSeconds
  const total = position.video.durationSeconds
  const progress = total > 0 ? (elapsed / total) * 100 : 0

  return (
    <button
      ref={barRef}
      type="button"
      onClick={onTap}
      className="shrink-0 flex flex-col w-full touch-pan-x"
      style={{
        backgroundColor: '#0d0d0d',
        borderBottom: '1px solid rgba(57,255,20,0.12)',
        WebkitTapHighlightColor: 'transparent',
      }}
      aria-label="Now playing — tap for guide, swipe to change channel"
    >
      {/* Content row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <ChannelBadge channelNumber={channel.number} size="md" />
        <div className="min-w-0 flex-1">
          <div
            className="font-mono text-sm tracking-widest truncate"
            style={{ color: '#39ff14', fontFamily: MONO_FONT }}
          >
            {channel.name.toUpperCase()}
          </div>
          <div
            className="font-mono text-xs tracking-wider truncate"
            style={{ color: 'rgba(255,165,0,0.85)', fontFamily: MONO_FONT }}
          >
            {position.video.title}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="w-full"
        style={{ height: 2, backgroundColor: 'rgba(57,255,20,0.1)' }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(progress, 100)}%`,
            backgroundColor: 'rgba(57,255,20,0.5)',
            transition: 'width 1s linear',
          }}
        />
      </div>
    </button>
  )
}
