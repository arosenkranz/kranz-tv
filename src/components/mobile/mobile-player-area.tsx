import { Play } from 'lucide-react'
import { TvPlayer } from '~/components/tv-player'
import { overlayClassName } from '~/lib/overlays'
import { getThumbnailUrl } from '~/lib/video-utils'
import { MONO_FONT } from '~/lib/theme'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'
import type { OverlayMode } from '~/lib/overlays'

interface MobilePlayerAreaProps {
  readonly channel: Channel
  readonly position: SchedulePosition
  readonly isMuted: boolean
  readonly volume: number
  readonly isPlaying: boolean
  readonly onPlay: () => void
  readonly onResync: () => void
  readonly showStatic: boolean
  readonly overlayMode: OverlayMode
  readonly fillHeight: boolean
  readonly height?: string
}

export function MobilePlayerArea({
  channel,
  position,
  isMuted,
  volume,
  isPlaying,
  onPlay,
  onResync,
  showStatic,
  overlayMode,
  fillHeight,
  height = '40dvh',
}: MobilePlayerAreaProps) {
  const overlayClass =
    overlayMode !== 'none' ? overlayClassName(overlayMode) : ''
  const thumbnailUrl = getThumbnailUrl(position.video)

  return (
    <div
      className={`relative overflow-hidden ${fillHeight ? 'flex-1' : 'shrink-0'}`}
      style={fillHeight ? undefined : { height }}
    >
      {isPlaying ? (
        <>
          <TvPlayer
            channel={channel}
            position={position}
            isMuted={isMuted}
            volume={volume}
            onNeedsInteraction={() => {}}
            onResync={onResync}
            allowInteraction
          />
          {overlayClass && (
            <div
              className={overlayClass}
              aria-hidden="true"
              style={{ pointerEvents: 'none' }}
            />
          )}
          {showStatic && (
            <div
              className="static-burst absolute inset-0 pointer-events-none"
              aria-hidden="true"
              style={{ zIndex: 10 }}
            />
          )}
          {isMuted && (
            <div
              className="absolute top-2 right-2 rounded border px-2 py-0.5 font-mono text-xs tracking-widest"
              style={{
                backgroundColor: 'rgba(0,0,0,0.8)',
                borderColor: 'rgba(255,165,0,0.5)',
                color: 'rgba(255,165,0,0.9)',
                fontFamily: MONO_FONT,
              }}
            >
              MUTED
            </div>
          )}
        </>
      ) : (
        <div className="relative h-full w-full">
          <img
            src={thumbnailUrl}
            alt={position.video.title}
            referrerPolicy="no-referrer"
            className="h-full w-full"
            style={{ objectFit: 'cover' }}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
          />
          <button
            type="button"
            onClick={onPlay}
            className="absolute inset-0 flex items-center justify-center"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            aria-label="Play"
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 72,
                height: 72,
                backgroundColor: 'rgba(0,0,0,0.7)',
                border: '2px solid rgba(57,255,20,0.8)',
              }}
            >
              <Play size={32} color="#39ff14" fill="#39ff14" />
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
