import { useState, useEffect, useRef, useCallback } from 'react'
import { MobilePlayerArea } from '~/components/mobile/mobile-player-area'
import { MobileNowNextBar } from '~/components/mobile/mobile-now-next-bar'
import { MobileGuideSheet } from '~/components/mobile/mobile-guide-sheet'
import { MobileFullscreenPrompt } from '~/components/mobile/mobile-fullscreen-prompt'
import { MobileToolbar } from '~/components/mobile/mobile-toolbar'
import { MobileHelpOverlay } from '~/components/mobile/mobile-help-overlay'
import { ChannelSurfStatic } from '~/components/channel-surf-static'
import { useOrientation } from '~/hooks/use-orientation'
import { useSwipeGesture } from '~/hooks/use-swipe-gesture'
import { useOnboarding } from '~/hooks/use-onboarding'
import { vibrate } from '~/lib/haptic'
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
  readonly isFullscreen: boolean
  readonly onToggleMute: () => void
  readonly onPlay: () => void
  readonly onChannelSelect: (id: string) => void
  readonly onNextChannel: () => void
  readonly onPrevChannel: () => void
  readonly onResync: () => void
  readonly onShare: () => void
  readonly onCycleOverlay: () => void
  readonly onToggleInfo: () => void
  readonly onFullscreen: () => void
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
  isFullscreen,
  onToggleMute,
  onPlay,
  onChannelSelect,
  onNextChannel,
  onPrevChannel,
  onResync,
  onShare,
  onCycleOverlay,
  onToggleInfo,
  onFullscreen,
  showStatic,
  overlayMode,
  allPresets,
  loadedChannels,
  currentChannelId,
  surfState,
}: MobileViewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [landscapePromptDismissed, setLandscapePromptDismissed] = useState(false)
  const { needsOnboarding, dismissOnboarding } = useOnboarding()
  const containerRef = useRef<HTMLDivElement>(null)
  const orientation = useOrientation()
  const isLandscape = orientation === 'landscape'

  // Reset poster state on channel change
  useEffect(() => {
    setIsPlaying(false)
  }, [channel.id])

  // Exit fullscreen on portrait return + reset landscape prompt
  useEffect(() => {
    if (orientation === 'portrait') {
      if (isFullscreen) onFullscreen()
      setLandscapePromptDismissed(false)
    }
  }, [orientation, isFullscreen, onFullscreen])

  const handleLandscapeFullscreen = useCallback((): void => {
    onFullscreen()
    trackLandscapeFullscreen()
  }, [onFullscreen])

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

  const handleSwipe = useCallback(
    (direction: 'up' | 'down') => {
      if (guideOpen || showHelp || needsOnboarding) return
      if (direction === 'up') handleSwipeUp()
      else handleSwipeDown()
    },
    [handleSwipeUp, handleSwipeDown, guideOpen, showHelp, needsOnboarding],
  )

  useSwipeGesture(containerRef, { threshold: 40, onSwipe: handleSwipe })

  const showLandscapePrompt =
    isLandscape && isPlaying && !isFullscreen && !landscapePromptDismissed

  // Fullscreen: just the player
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
    <div ref={containerRef} className="flex w-screen flex-col overflow-hidden bg-black" style={{ height: '100dvh' }}>
      {/* Player area — taller in landscape for more video visibility */}
      <div className="relative shrink-0" style={{ height: isLandscape ? '60dvh' : '40dvh' }}>
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
          onTap={handleLandscapeFullscreen}
          onDismiss={() => setLandscapePromptDismissed(true)}
        />
      </div>

      {/* Now/Next bar */}
      <MobileNowNextBar
        channel={channel}
        position={position}
        onTap={handleOpenGuide}
      />

      {/* Control toolbar */}
      <MobileToolbar
        isMuted={isMuted}
        overlayMode={overlayMode}
        onToggleMute={onToggleMute}
        onShare={onShare}
        onCycleOverlay={onCycleOverlay}
        onToggleInfo={onToggleInfo}
        onFullscreen={onFullscreen}
        onHelp={() => setShowHelp(true)}
      />

      {/* Guide sheet */}
      <MobileGuideSheet
        isOpen={guideOpen}
        onOpen={handleOpenGuide}
        onClose={() => setGuideOpen(false)}
        onChannelSelect={onChannelSelect}
        allPresets={allPresets}
        loadedChannels={loadedChannels}
        currentChannelId={currentChannelId}
      />

      {/* Help overlay — auto-shows on first visit, re-openable via toolbar */}
      <MobileHelpOverlay
        visible={showHelp || needsOnboarding}
        onDismiss={() => {
          setShowHelp(false)
          dismissOnboarding()
        }}
      />
    </div>
  )
}
