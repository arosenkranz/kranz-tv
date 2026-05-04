import { useState, useEffect, useRef, useCallback } from 'react'
import { MobilePlayerArea } from '~/components/mobile/mobile-player-area'
import { MobileNowPlaying } from '~/components/mobile/mobile-now-playing'
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
  readonly onFullscreen: () => void
  readonly showStatic: boolean
  readonly overlayMode: OverlayMode
  readonly showOverlayToast: boolean
  readonly toast: {
    readonly visible: boolean
    readonly message: string
    readonly detail: string | undefined
  }
  readonly allPresets: ChannelPreset[]
  readonly loadedChannels: Map<string, Channel>
  readonly currentChannelId: string
  readonly surfState: {
    readonly showStatic: boolean
    readonly showOsd: boolean
    readonly channel: ChannelPreset | null
    readonly navigationSource: 'keyboard' | 'direct' | 'surf'
  }
  readonly onSurfToggle?: () => void
  readonly isSurfing?: boolean
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
  onFullscreen,
  showStatic,
  overlayMode,
  showOverlayToast,
  toast,
  allPresets,
  loadedChannels,
  currentChannelId,
  surfState,
  onSurfToggle,
  isSurfing = false,
}: MobileViewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [landscapePromptDismissed, setLandscapePromptDismissed] =
    useState(false)
  // Track whether fullscreen was auto-entered via landscape prompt (vs. manual toolbar tap)
  const landscapeFullscreenRef = useRef(false)
  // Track whether user has had their first play interaction this session.
  // Only the first tap needs to force-mute (browser autoplay policy); subsequent
  // channel switches should respect the user's current mute preference.
  const hasPlayedRef = useRef(false)
  const { needsOnboarding, dismissOnboarding } = useOnboarding('mobile')
  const containerRef = useRef<HTMLDivElement>(null)
  const orientation = useOrientation()
  const isLandscape = orientation === 'landscape'

  // Reset poster state on channel change
  useEffect(() => {
    setIsPlaying(false)
  }, [channel.id])

  // Auto-exit fullscreen on portrait return, but only if it was auto-entered via landscape
  useEffect(() => {
    if (orientation === 'portrait') {
      if (isFullscreen && landscapeFullscreenRef.current) {
        landscapeFullscreenRef.current = false
        onFullscreen()
      }
      setLandscapePromptDismissed(false)
    }
  }, [orientation, isFullscreen, onFullscreen])

  const handleLandscapeFullscreen = useCallback((): void => {
    landscapeFullscreenRef.current = true
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
    // No-op in landscape — guide is hidden, opening it would set ghost state
    if (isLandscape) return
    setGuideOpen(true)
    trackGuideSheetOpen()
  }, [isLandscape])

  const showLandscapePrompt =
    isLandscape && isPlaying && !isFullscreen && !landscapePromptDismissed

  const handleSwipe = useCallback(
    (direction: 'up' | 'down') => {
      if (guideOpen || showHelp || needsOnboarding || showLandscapePrompt)
        return
      if (direction === 'up') handleSwipeUp()
      else handleSwipeDown()
    },
    [
      handleSwipeUp,
      handleSwipeDown,
      guideOpen,
      showHelp,
      needsOnboarding,
      showLandscapePrompt,
    ],
  )

  useSwipeGesture(containerRef, { threshold: 40, onSwipe: handleSwipe })

  // Fullscreen: just the player (uses fixed positioning for iOS pseudo-fullscreen)
  if (isFullscreen) {
    return (
      <div
        className="bg-black"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          width: '100vw',
          height: '100dvh',
        }}
      >
        <MobilePlayerArea
          channel={channel}
          position={position}
          isMuted={isMuted}
          volume={volume}
          isPlaying={isPlaying}
          onPlay={() => {
            if (!hasPlayedRef.current) {
              onPlay()
              hasPlayedRef.current = true
            }
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
          navigationSource={surfState.navigationSource}
        />
        {/* Exit fullscreen button — especially needed on iOS pseudo-fullscreen */}
        <button
          type="button"
          onClick={onFullscreen}
          className="absolute right-3 rounded border px-3 py-1.5 font-mono text-xs tracking-widest"
          style={{
            top: 'max(0.75rem, env(safe-area-inset-top, 0.75rem))',
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
    <div
      ref={containerRef}
      className="flex w-screen flex-col overflow-hidden bg-black"
      style={{ height: '100dvh' }}
    >
      {/* Player area — fills most of viewport in landscape, 40% in portrait */}
      <div
        className={`relative min-h-0 ${isLandscape ? 'flex flex-col flex-1' : ''}`}
        style={isLandscape ? undefined : { height: '40dvh', flex: 'none' }}
      >
        <MobilePlayerArea
          channel={channel}
          position={position}
          isMuted={isMuted}
          volume={volume}
          isPlaying={isPlaying}
          onPlay={() => {
            if (!hasPlayedRef.current) {
              onPlay()
              hasPlayedRef.current = true
            }
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
          navigationSource={surfState.navigationSource}
        />
        <MobileFullscreenPrompt
          visible={showLandscapePrompt}
          onTap={handleLandscapeFullscreen}
          onDismiss={() => setLandscapePromptDismissed(true)}
        />
      </div>

      {/* Now/Next bar — hidden in landscape to give the player full viewport height */}
      {!isLandscape && (
        <MobileNowNextBar
          channel={channel}
          position={position}
          onTap={handleOpenGuide}
        />
      )}

      {/* Control toolbar — hidden in landscape to maximize video area */}
      {!isLandscape && (
        <MobileToolbar
          isMuted={isMuted}
          overlayMode={overlayMode}
          onToggleMute={onToggleMute}
          onShare={onShare}
          onCycleOverlay={onCycleOverlay}
          onFullscreen={onFullscreen}
          onHelp={() => setShowHelp(true)}
          onSurfToggle={onSurfToggle}
          isSurfing={isSurfing}
        />
      )}

      {/* Now Playing panel — always visible in portrait, fills remaining space */}
      {!isLandscape && (
        <MobileNowPlaying channel={channel} position={position} />
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
