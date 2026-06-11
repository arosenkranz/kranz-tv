import { useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { TvPlayer } from '~/components/tv-player'
import { OverlayCanvas } from '~/components/overlay-canvas'
import { MusicChannelView } from '~/components/music-channel-view'
import { getThumbnailUrl } from '~/lib/video-utils'
import { MONO_FONT } from '~/lib/theme'
import { trackMobileYtOneTap } from '~/lib/datadog/rum'
import type { Channel, SchedulePosition, Video } from '~/lib/scheduling/types'
import type { OverlayMode } from '~/lib/overlays'
import type { VisualizerPreset } from '~/lib/visualizers/types'

interface MobilePlayerAreaProps {
  readonly channel: Channel
  readonly position: SchedulePosition
  readonly isMuted: boolean
  readonly volume: number
  readonly isPlaying: boolean
  readonly onPlay: () => void
  readonly onResync: () => void
  readonly onUnmute?: () => void
  readonly showStatic: boolean
  readonly overlayMode: OverlayMode
  readonly fillHeight: boolean
  readonly height?: string
  readonly activePreset?: VisualizerPreset
}

export function MobilePlayerArea({
  channel,
  position,
  isMuted,
  volume,
  isPlaying,
  onPlay,
  onResync,
  onUnmute,
  showStatic,
  overlayMode,
  fillHeight,
  height = '40dvh',
  activePreset = 'spectrum',
}: MobilePlayerAreaProps) {
  // Music channels render MusicChannelView instead of TvPlayer.
  // The getThumbnailUrl cast below assumes Video — it crashes for Track.
  if (channel.kind === 'music') {
    return (
      <div
        className={`relative overflow-hidden ${fillHeight ? 'flex-1' : 'shrink-0'}`}
        style={
          fillHeight
            ? { isolation: 'isolate' as const }
            : { height, isolation: 'isolate' as const }
        }
      >
        <MusicChannelView
          channel={channel}
          position={position}
          isMuted={isMuted}
          volume={volume}
          onUnmute={onUnmute ?? (() => {})}
          activePreset={activePreset}
          isMobile={true}
        />
      </div>
    )
  }

  return (
    <VideoPlayerArea
      channel={channel}
      position={position}
      isMuted={isMuted}
      volume={volume}
      isPlaying={isPlaying}
      onPlay={onPlay}
      onResync={onResync}
      showStatic={showStatic}
      overlayMode={overlayMode}
      fillHeight={fillHeight}
      height={height}
    />
  )
}

interface VideoPlayerAreaProps {
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
  readonly height: string
}

function VideoPlayerArea({
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
  height,
}: VideoPlayerAreaProps) {
  // Pre-mount TvPlayer so the poster button tap can call playVideo() directly
  // on the already-live YT IFrame API — satisfying browser autoplay in one tap.
  const ytPlayerRef = useRef<YT.Player | null>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const thumbnailUrl = getThumbnailUrl(position.item as Video)

  return (
    <div
      className={`relative overflow-hidden ${fillHeight ? 'flex-1' : 'shrink-0'}`}
      style={
        fillHeight
          ? { isolation: 'isolate' as const }
          : { height, isolation: 'isolate' as const }
      }
    >
      {/* TvPlayer always mounted — hidden beneath the poster until isPlaying */}
      <div
        className="absolute inset-0"
        style={{ visibility: isPlaying ? 'visible' : 'hidden' }}
      >
        <TvPlayer
          channel={channel}
          position={position}
          isMuted={isMuted}
          volume={volume}
          onNeedsInteraction={() => {}}
          onResync={onResync}
          allowInteraction
          onPlayerReady={(player) => {
            ytPlayerRef.current = player
            setPlayerReady(true)
          }}
        />
      </div>

      {isPlaying && (
        <>
          <OverlayCanvas mode={overlayMode} />
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
      )}

      {/* Poster overlay — visible until the user taps play */}
      {!isPlaying && (
        <div className="absolute inset-0">
          <img
            src={thumbnailUrl}
            alt={(position.item as Video).title}
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
            onClick={() => {
              // Call playVideo() synchronously in this gesture handler so the
              // browser autoplay policy is satisfied in a single tap. The player
              // is already mounted and ready; this is a postMessage to the iframe.
              if (playerReady && ytPlayerRef.current) {
                ytPlayerRef.current.playVideo()
                trackMobileYtOneTap()
              }
              onPlay()
            }}
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
