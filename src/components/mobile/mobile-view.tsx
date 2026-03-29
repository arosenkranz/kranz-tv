import { useState, useEffect, useRef, useCallback } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { MobilePlayerArea } from '~/components/mobile/mobile-player-area'
import { MobileNowNextBar } from '~/components/mobile/mobile-now-next-bar'
import { MobileGuideSheet } from '~/components/mobile/mobile-guide-sheet'
import { MobileFullscreenPrompt } from '~/components/mobile/mobile-fullscreen-prompt'
import { ChannelSurfStatic } from '~/components/channel-surf-static'
import { useOrientation } from '~/hooks/use-orientation'
import { vibrate } from '~/lib/haptic'
import { MONO_FONT } from '~/lib/theme'
import {
  trackSwipeChannelChange,
  trackLandscapeFullscreen,
  trackGuideSheetOpen,
} from '~/lib/datadog/rum'
import type { ChannelPreset } from '~/lib/channels/types'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'
import type { OverlayMode } from '~/lib/overlays'

interface MobileViewProps {
  readonly channel: Channel
  readonly position: SchedulePosition
  readonly isMuted: boolean
  readonly volume: number
  readonly onToggleMute: () => void
  readonly onVolumeChange: (v: number) => void
  readonly onPlay: () => void
  readonly onChannelSelect: (id: string) => void
  readonly onNextChannel: () => void
  readonly onPrevChannel: () => void
  readonly onResync: () => void
  readonly showStatic: boolean
  readonly overlayMode: OverlayMode
  readonly allPresets: ChannelPreset[]
  readonly loadedChannels: Map<string, Channel>
  readonly currentChannelId: string
  readonly surfState: {
    readonly showStatic: boolean
    readonly showOsd: boolean
    readonly channel: ChannelPreset | null
  }
}

export function MobileView({
  channel,
  position,
  isMuted,
  volume,
  onToggleMute,
  onVolumeChange,
  onPlay,
  onChannelSelect,
  onNextChannel,
  onPrevChannel,
  onResync,
  showStatic,
  overlayMode,
  allPresets,
  loadedChannels,
  currentChannelId,
  surfState,
}: MobileViewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const sliderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const orientation = useOrientation()
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Reset poster state on channel change
  useEffect(() => {
    setIsPlaying(false)
    setShowVolumeSlider(false)
  }, [channel.id])

  // Cleanup slider timer
  useEffect(() => {
    return () => {
      if (sliderTimerRef.current !== null) clearTimeout(sliderTimerRef.current)
    }
  }, [])

  // Track fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = (): void => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Exit fullscreen on portrait return
  useEffect(() => {
    if (orientation === 'portrait' && isFullscreen) {
      void document.exitFullscreen().catch(() => {})
    }
  }, [orientation, isFullscreen])

  const resetSliderTimer = (): void => {
    if (sliderTimerRef.current !== null) clearTimeout(sliderTimerRef.current)
    sliderTimerRef.current = setTimeout(() => setShowVolumeSlider(false), 3000)
  }

  const handleFullscreen = useCallback((): void => {
    void document.documentElement.requestFullscreen().catch(() => {})
    trackLandscapeFullscreen()
  }, [])

  const handleSwipeUp = useCallback((): void => {
    vibrate()
    trackSwipeChannelChange('up', currentChannelId)
    onNextChannel()
  }, [currentChannelId, onNextChannel])

  const handleSwipeDown = useCallback((): void => {
    vibrate()
    trackSwipeChannelChange('down', currentChannelId)
    onPrevChannel()
  }, [currentChannelId, onPrevChannel])

  const handleOpenGuide = useCallback((): void => {
    setGuideOpen(true)
    trackGuideSheetOpen()
  }, [])

  const showLandscapePrompt =
    orientation === 'landscape' && isPlaying && !isFullscreen

  // Fullscreen landscape: just the player
  if (isFullscreen) {
    return (
      <div className="relative h-screen w-screen bg-black">
        <MobilePlayerArea
          channel={channel}
          position={position}
          isMuted={isMuted}
          volume={volume}
          isPlaying={isPlaying}
          onPlay={() => {
            onPlay()
            setIsPlaying(true)
          }}
          onResync={onResync}
          showStatic={showStatic}
          overlayMode={overlayMode}
          fillHeight={true}
        />
        <ChannelSurfStatic
          channel={surfState.channel}
          showStatic={surfState.showStatic}
          showOsd={surfState.showOsd}
        />
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-black">
      {/* Player area */}
      <div className="relative shrink-0" style={{ height: '40vh' }}>
        <MobilePlayerArea
          channel={channel}
          position={position}
          isMuted={isMuted}
          volume={volume}
          isPlaying={isPlaying}
          onPlay={() => {
            onPlay()
            setIsPlaying(true)
          }}
          onResync={onResync}
          showStatic={showStatic}
          overlayMode={overlayMode}
          fillHeight={false}
        />
        <ChannelSurfStatic
          channel={surfState.channel}
          showStatic={surfState.showStatic}
          showOsd={surfState.showOsd}
        />
        <MobileFullscreenPrompt
          visible={showLandscapePrompt}
          onTap={handleFullscreen}
        />
      </div>

      {/* Now/Next bar with swipe */}
      <div className="shrink-0 flex items-center">
        <MobileNowNextBar
          channel={channel}
          position={position}
          onTap={handleOpenGuide}
          onSwipeUp={handleSwipeUp}
          onSwipeDown={handleSwipeDown}
        />
        {/* Volume + mute controls */}
        <div
          className="shrink-0 flex items-center gap-1 px-2"
          style={{
            backgroundColor: '#0d0d0d',
            borderBottom: '1px solid rgba(57,255,20,0.12)',
            height: 56,
          }}
        >
          {showVolumeSlider && (
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              aria-label="Volume"
              onChange={(e) => {
                onVolumeChange(Number(e.target.value))
                vibrate(5)
                resetSliderTimer()
              }}
              style={{
                width: '60px',
                height: '4px',
                accentColor: '#39ff14',
                cursor: 'pointer',
                opacity: isMuted ? 0.5 : 1,
              }}
            />
          )}
          <button
            type="button"
            onClick={() => {
              setShowVolumeSlider((v) => {
                if (!v) resetSliderTimer()
                return !v
              })
            }}
            className="rounded p-2"
            style={{
              color: showVolumeSlider
                ? 'rgba(57,255,20,0.9)'
                : 'rgba(255,255,255,0.4)',
              backgroundColor: 'transparent',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label="Toggle volume slider"
          >
            <Volume2 size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleMute()
              vibrate()
            }}
            className="rounded p-2"
            style={{
              color: isMuted ? 'rgba(255,165,0,0.9)' : 'rgba(255,255,255,0.6)',
              backgroundColor: 'transparent',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>

      {/* Guide sheet */}
      <MobileGuideSheet
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        onChannelSelect={onChannelSelect}
        allPresets={allPresets}
        loadedChannels={loadedChannels}
        currentChannelId={currentChannelId}
      />
    </div>
  )
}
