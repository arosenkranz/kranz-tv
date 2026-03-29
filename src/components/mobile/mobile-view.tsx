import { useState, useEffect, useRef, useCallback } from 'react'
import { MobilePlayerArea } from '~/components/mobile/mobile-player-area'
import { MobileNowNextBar } from '~/components/mobile/mobile-now-next-bar'
import { MobileGuideSheet } from '~/components/mobile/mobile-guide-sheet'
import { MobileFullscreenPrompt } from '~/components/mobile/mobile-fullscreen-prompt'
import { MobileToolbar } from '~/components/mobile/mobile-toolbar'
import { MobileHelpOverlay } from '~/components/mobile/mobile-help-overlay'
import { ChannelSurfStatic } from '~/components/channel-surf-static'
import { Toast } from '~/components/toast'
import { useOrientation } from '~/hooks/use-orientation'
import { useSwipeGesture } from '~/hooks/use-swipe-gesture'
import { useOnboarding } from '~/hooks/use-onboarding'
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
  readonly showInfo: boolean
  readonly showOverlayToast: boolean
  readonly toast: { readonly visible: boolean; readonly message: string; readonly detail: string | undefined }
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
  showInfo,
  showOverlayToast,
  toast,
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

  // Fullscreen: just the player (uses fixed positioning for iOS pseudo-fullscreen)
  if (isFullscreen) {
    return (
      <div
        className="bg-black"
        style={{ position: 'fixed', inset: 0, zIndex: 9999, width: '100vw', height: '100dvh' }}
      >
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
        {/* Exit fullscreen button — especially needed on iOS pseudo-fullscreen */}
        <button
          type="button"
          onClick={onFullscreen}
          className="absolute top-3 right-3 rounded border px-3 py-1.5 font-mono text-xs tracking-widest"
          style={{
            backgroundColor: 'rgba(0,0,0,0.7)',
            borderColor: 'rgba(57,255,20,0.3)',
            color: 'rgba(57,255,20,0.8)',
            fontFamily: MONO_FONT,
            zIndex: 10,
            WebkitTapHighlightColor: 'transparent',
          }}
          aria-label="Exit fullscreen"
        >
          EXIT
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex w-screen flex-col overflow-hidden bg-black" style={{ height: '100dvh' }}>
      {/* Player area — fills most of viewport in landscape, 40% in portrait */}
      <div className="relative flex-1 min-h-0" style={isLandscape ? undefined : { height: '40dvh', flex: 'none' }}>
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
          fillHeight={isLandscape}
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

      {/* Now/Next bar — compact in landscape */}
      <MobileNowNextBar
        channel={channel}
        position={position}
        onTap={handleOpenGuide}
      />

      {/* Control toolbar — hidden in landscape to maximize video area */}
      {!isLandscape && (
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
      )}

      {/* Guide sheet — hidden in landscape */}
      {!isLandscape && (
        <MobileGuideSheet
          isOpen={guideOpen}
          onOpen={handleOpenGuide}
          onClose={() => setGuideOpen(false)}
          onChannelSelect={onChannelSelect}
          allPresets={allPresets}
          loadedChannels={loadedChannels}
          currentChannelId={currentChannelId}
        />
      )}

      {/* Help overlay — auto-shows on first visit, re-openable via toolbar */}
      <MobileHelpOverlay
        visible={showHelp || needsOnboarding}
        onDismiss={() => {
          setShowHelp(false)
          dismissOnboarding()
        }}
      />

      {/* Info overlay — channel + now-playing details */}
      {showInfo && (
        <div
          className="absolute top-2 left-2 right-2 rounded border px-4 py-3"
          style={{
            backgroundColor: 'rgba(0,0,0,0.85)',
            borderColor: 'rgba(57,255,20,0.4)',
            zIndex: 55,
          }}
        >
          <div
            className="font-mono text-lg tracking-widest"
            style={{ color: '#39ff14', fontFamily: MONO_FONT }}
          >
            CH {channel.number} — {channel.name.toUpperCase()}
          </div>
          <div
            className="mt-1 font-mono text-sm tracking-wider"
            style={{ color: 'rgba(255,165,0,0.9)', fontFamily: MONO_FONT }}
          >
            {position.video.title}
          </div>
          <div className="mt-2 flex gap-4">
            <a
              href={`https://www.youtube.com/watch?v=${position.video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs tracking-wider underline"
              style={{ color: 'rgba(255,255,255,0.45)', fontFamily: MONO_FONT }}
            >
              ▶ WATCH ON YOUTUBE
            </a>
            {channel.playlistId && (
              <a
                href={`https://www.youtube.com/playlist?list=${channel.playlistId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs tracking-wider underline"
                style={{ color: 'rgba(255,255,255,0.45)', fontFamily: MONO_FONT }}
              >
                ☰ VIEW PLAYLIST
              </a>
            )}
          </div>
        </div>
      )}

      {/* Overlay mode toast — brief feedback when cycling overlays */}
      {showOverlayToast && (
        <div
          className="absolute bottom-20 right-3 rounded border px-3 py-2 font-mono text-sm tracking-widest uppercase"
          style={{
            backgroundColor: 'rgba(0,0,0,0.85)',
            borderColor: 'rgba(57,255,20,0.4)',
            color: '#39ff14',
            fontFamily: MONO_FONT,
            zIndex: 60,
          }}
        >
          OVERLAY: {overlayMode === 'none' ? 'OFF' : overlayMode.toUpperCase()}
        </div>
      )}

      {/* Share/general toast */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        detail={toast.detail}
      />
    </div>
  )
}
