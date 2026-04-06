import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  trackChannelSwitch,
  trackChannelSurf,
  trackKeyboardShortcut,
  trackVolumeChange,
  trackShareChannel,
} from '~/lib/datadog/rum'
import { useVolumeOsd } from '~/hooks/use-volume-osd'
import { useChannelSurf } from '~/hooks/use-channel-surf'
import { useToast } from '~/hooks/use-toast'
import { copyToClipboard } from '~/lib/clipboard'
import { Toast } from '~/components/toast'
import { VolumeOsd } from '~/components/volume-osd'
import { ChannelSurfStatic } from '~/components/channel-surf-static'
import { adjustVolume, VOLUME_STEP } from '~/lib/volume'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import { buildChannel, YouTubeQuotaError } from '~/lib/channels/youtube-api'
import { loadCustomChannels } from '~/lib/storage/local-channels'
import {
  loadCachedChannel,
  saveCachedChannel,
  clearPresetChannelCache,
} from '~/lib/storage/preset-channel-cache'
import { useCurrentProgram } from '~/hooks/use-current-program'
import { useChannelNavigation } from '~/hooks/use-channel-navigation'
import { useKeyboardControls } from '~/hooks/use-keyboard-controls'
import { useTvLayout } from '~/routes/_tv'
import { TvPlayer } from '~/components/tv-player'
import { KeyboardHelp } from '~/components/keyboard-help'
import { DesktopWelcome } from '~/components/desktop-welcome'
import { useOnboarding } from '~/hooks/use-onboarding'
import { MobileView } from '~/components/mobile/mobile-view'
import { SurfInfoBar } from '~/components/surf-info-bar'
import { useSurfModeContext } from '~/contexts/surf-mode-context'
import { channelToPreset } from '~/lib/import/schema'
import type { Channel } from '~/lib/scheduling/types'
import type { ChannelPreset } from '~/lib/channels/types'
import { getThumbnailUrl } from '~/lib/video-utils'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import { MONO_FONT } from '~/lib/theme'

const MONO = MONO_FONT

export const Route = createFileRoute('/_tv/channel/$channelId')({
  component: ChannelView,
})

// ---------------------------------------------------------------------------
// Mock channel fallback — used when no YouTube API key is configured
// ---------------------------------------------------------------------------

function buildMockChannel(channelId: string): Channel {
  const preset = CHANNEL_PRESETS.find((p) => p.id === channelId)
  return {
    id: channelId,
    number: preset?.number ?? 1,
    name: preset?.name ?? 'Channel',
    playlistId: '',
    videos: [
      {
        id: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        durationSeconds: 212,
        thumbnailUrl: '',
      },
      {
        id: 'jNQXAC9IVRw',
        title: 'Me at the zoo',
        durationSeconds: 19,
        thumbnailUrl: '',
      },
      {
        id: 'ZZ5LpwO-An4',
        title: 'Gangnam Style',
        durationSeconds: 492,
        thumbnailUrl: '',
      },
    ],
    totalDurationSeconds: 723,
  }
}

// ---------------------------------------------------------------------------
// Channel view component
// ---------------------------------------------------------------------------

export function ChannelView() {
  const { channelId } = Route.useParams()
  const navigate = useNavigate()
  const {
    toggleGuide,
    toggleImport,
    registerChannel,
    setCurrentChannelId,
    loadedChannels,
    customChannels,
    toggleFullscreen,
    isFullscreen,
    isTheater,
    toggleTheater,
    cycleOverlay,
    overlayMode,
    isMuted,
    toggleMute,
    volume,
    setVolume,
    isMobile,
    isQuotaExhausted,
    setQuotaExhausted,
  } = useTvLayout()

  const {
    isSurfing,
    countdown,
    dwellSeconds,
    startSurf,
    stopSurf,
    setDwellSeconds: setSurfDwellSeconds,
  } = useSurfModeContext()

  // Immediately update layout's currentChannelId when the route changes — before
  // channel data loads — so the toolbar and guide reflect the correct channel instantly.
  useEffect(() => {
    setCurrentChannelId(channelId)
  }, [channelId, setCurrentChannelId])

  // Track channel switches in RUM — catches all navigation paths (keyboard, EPG, deep link, back/forward)
  const prevChannelIdRef = useRef<string | null>(null)
  useEffect(() => {
    const findNumber = (id: string) =>
      allChannels.find((c) => c.id === id)?.number ?? 0
    trackChannelSwitch(
      prevChannelIdRef.current ?? 'none',
      channelId,
      findNumber(prevChannelIdRef.current ?? ''),
      findNumber(channelId),
    )
    prevChannelIdRef.current = channelId
  }, [channelId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep a ref that stays current without being an effect dependency, so the
  // cache can be read on channel change without re-running the effect when
  // unrelated channels load into the layout.
  const loadedChannelsRef = useRef(loadedChannels)
  loadedChannelsRef.current = loadedChannels

  // Derive the active channel synchronously from the layout's shared Map.
  // For cached channels (the common case after first visit), this is correct
  // on the very first render after channelId changes — no effect delay.
  const cachedChannel = loadedChannels.get(channelId) ?? null

  // Only used for the async case: API fetch or mock fallback on first visit.
  const [fetchedChannel, setFetchedChannel] = useState<Channel | null>(null)

  // Prefer layout cache; fall back to locally fetched result.
  const loadedChannel = cachedChannel ?? fetchedChannel

  const [needsInteraction, setNeedsInteraction] = useState(false)
  // Gate rendering until after hydration so isMobile is accurate.
  // Prevents a desktop TvPlayer from briefly mounting on mobile during the
  // SSR→client handoff (which would inject the YT script prematurely).
  const [clientReady, setClientReady] = useState(false)
  useEffect(() => {
    setClientReady(true)
  }, [])

  const preset = CHANNEL_PRESETS.find((p) => p.id === channelId)

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showStatic, setShowStatic] = useState(false)
  const staticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showOverlayToast, setShowOverlayToast] = useState(false)
  const { needsOnboarding: needsDesktopOnboarding, dismissOnboarding: dismissDesktopOnboarding } = useOnboarding('desktop')
  const { visible: osdVisible } = useVolumeOsd(volume, isMuted)
  const toast = useToast()
  const shareDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleShare = useCallback((): void => {
    // Block re-entry for 500ms to prevent toast spam from rapid S presses
    if (shareDebounceRef.current !== null) return

    shareDebounceRef.current = setTimeout(() => {
      shareDebounceRef.current = null
    }, 500)

    const url = window.location.href
    void copyToClipboard(url).then((success) => {
      if (success) {
        toast.show('LINK COPIED', url)
      } else {
        toast.show('COPY FAILED')
      }
      trackShareChannel(channelId, success)
    })
  }, [channelId, toast])

  const overlayToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  // Merge preset + custom channels for navigation
  const allChannels = useMemo(() => {
    const presetEntries = CHANNEL_PRESETS.map((p) => ({
      id: p.id,
      number: p.number,
    }))
    const customEntries = customChannels.map((c) => ({
      id: c.id,
      number: c.number,
    }))
    return [...presetEntries, ...customEntries]
  }, [customChannels])

  // All presets (preset + custom) for mobile guide and channel navigation
  const allPresets = useMemo<ChannelPreset[]>(
    () => [...CHANNEL_PRESETS, ...customChannels.map(channelToPreset)],
    [customChannels],
  )

  const position = useCurrentProgram(loadedChannel)
  const { nextChannel, prevChannel } = useChannelNavigation(
    channelId,
    allChannels,
  )
  const { surfState, setNavigationSource, triggerSurf } = useChannelSurf()

  // When the channel changes during surf mode, trigger the subtler surf static.
  // The channelId change is the signal that a surf hop occurred.
  const prevSurfChannelRef = useRef(channelId)
  useEffect(() => {
    if (prevSurfChannelRef.current === channelId) return
    const prevId = prevSurfChannelRef.current
    prevSurfChannelRef.current = channelId

    if (isSurfing) {
      // Set surf source so triggerSurf uses subtler timings
      setNavigationSource('surf')
      const targetPreset = allPresets.find((p) => p.id === channelId)
      if (targetPreset) {
        triggerSurf(targetPreset)
        trackChannelSurf(targetPreset.id, targetPreset.number)
      }
    } else if (prevId !== channelId) {
      // Manual channel switch during non-surf — handled by keyboard handlers below
    }
  }, [channelId, isSurfing, allPresets, setNavigationSource, triggerSurf])

  // Wrap channel navigation for keyboard — set source before navigating
  // so the surf hook knows to trigger the static animation
  const handleKeyboardChannelUp = useCallback((): void => {
    setNavigationSource('keyboard')
    const currentIndex = allChannels.findIndex((c) => c.id === channelId)
    const targetIndex = (currentIndex - 1 + allChannels.length) % allChannels.length
    const targetPreset = allPresets.find((p) => p.id === allChannels[targetIndex]?.id)
    if (targetPreset) {
      triggerSurf(targetPreset)
      trackChannelSurf(targetPreset.id, targetPreset.number)
    }
    prevChannel()
  }, [setNavigationSource, triggerSurf, prevChannel, allPresets, allChannels, channelId])

  const handleKeyboardChannelDown = useCallback((): void => {
    setNavigationSource('keyboard')
    const currentIndex = allChannels.findIndex((c) => c.id === channelId)
    const targetIndex = (currentIndex + 1) % allChannels.length
    const targetPreset = allPresets.find((p) => p.id === allChannels[targetIndex]?.id)
    if (targetPreset) {
      triggerSurf(targetPreset)
      trackChannelSurf(targetPreset.id, targetPreset.number)
    }
    nextChannel()
  }, [setNavigationSource, triggerSurf, nextChannel, allPresets, allChannels, channelId])

  // Notify layout so the guide and toolbar can reflect the active channel
  useEffect(() => {
    if (loadedChannel !== null) {
      registerChannel(loadedChannel)
    }
  }, [loadedChannel, registerChannel])

  // Load channel data when channelId changes — only handles the async case
  // (API fetch or mock fallback). Cached channels are derived synchronously
  // from the layout Map above, so no loading effect needed for those.
  useEffect(() => {
    setFetchedChannel(null)
    setIsLoading(true)
    setLoadError(null)
    setNeedsInteraction(false)

    // If the layout Map already has this channel (from eager-fetch or prior visit),
    // the synchronous derivation above handles it — no async work needed.
    if (loadedChannelsRef.current.get(channelId) !== undefined) {
      setIsLoading(false)
      return
    }

    // Check localStorage TTL cache (survives page refreshes)
    const lsChannel = loadCachedChannel(channelId)
    if (lsChannel !== null) {
      setFetchedChannel(lsChannel)
      setIsLoading(false)
      return
    }

    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined

    // Check if it's a custom channel — read directly from localStorage so we
    // don't race against the layout's hydration effect populating loadedChannels
    if (preset === undefined) {
      const stored = loadCustomChannels()
      const customChannel =
        stored.find((c) => c.id === channelId) ??
        loadedChannelsRef.current.get(channelId)
      if (customChannel !== undefined) {
        setFetchedChannel(customChannel)
        setIsLoading(false)
        return
      }
    }

    if (
      !apiKey ||
      apiKey.trim() === '' ||
      preset === undefined ||
      isQuotaExhausted
    ) {
      // No API key, unrecognized channel, or quota exhausted — use mock data
      setFetchedChannel(buildMockChannel(channelId))
      setIsLoading(false)
      return
    }

    let cancelled = false

    buildChannel(preset, apiKey)
      .then((channel) => {
        if (!cancelled) {
          saveCachedChannel(channel)
          setFetchedChannel(channel)
          setIsLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (err instanceof YouTubeQuotaError) {
            clearPresetChannelCache()
            setQuotaExhausted()
            // Fall back silently — layout banner will inform the user
            setFetchedChannel(buildMockChannel(channelId))
            setIsLoading(false)
            return
          }
          const message =
            err instanceof Error ? err.message : 'Failed to load channel'
          setLoadError(message)
          // Fall back to mock data so the player still works
          setFetchedChannel(buildMockChannel(channelId))
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [channelId, preset, isQuotaExhausted, setQuotaExhausted])

  const handleResync = useCallback((): void => {
    if (staticTimerRef.current !== null) clearTimeout(staticTimerRef.current)
    setShowStatic(true)
    staticTimerRef.current = setTimeout(() => setShowStatic(false), 370)
  }, [])

  const handleToggleMute = useCallback((): void => {
    toggleMute()
    // Pressing M counts as user interaction — dismiss the click-to-unmute prompt
    setNeedsInteraction(false)
  }, [toggleMute])

  const handleToggleInfo = useCallback((): void => {
    setShowInfo((prev) => !prev)
  }, [])

  const handleHelp = useCallback((): void => {
    setShowHelp(true)
  }, [])

  const handleEscape = useCallback((): void => {
    // Dismiss topmost layer first — one Esc = one action
    if (needsDesktopOnboarding) {
      dismissDesktopOnboarding()
      return
    }
    if (showHelp) {
      setShowHelp(false)
      return
    }
    if (showInfo) {
      setShowInfo(false)
      return
    }
    if (isTheater) {
      toggleTheater()
      return
    }
  }, [needsDesktopOnboarding, dismissDesktopOnboarding, showHelp, showInfo, isTheater, toggleTheater])

  const handleHome = useCallback((): void => {
    void navigate({ to: '/' })
  }, [navigate])

  const handleVolumeUp = useCallback((): void => {
    const next = adjustVolume(volume, VOLUME_STEP)
    setVolume(next)
    trackVolumeChange(next, 'keyboard')
  }, [volume, setVolume])

  const handleVolumeDown = useCallback((): void => {
    const next = adjustVolume(volume, -VOLUME_STEP)
    setVolume(next)
    trackVolumeChange(next, 'keyboard')
  }, [volume, setVolume])

  const handleCycleOverlay = useCallback((): void => {
    cycleOverlay()
    if (overlayToastTimerRef.current !== null)
      clearTimeout(overlayToastTimerRef.current)
    setShowOverlayToast(true)
    overlayToastTimerRef.current = setTimeout(
      () => setShowOverlayToast(false),
      1500,
    )
  }, [cycleOverlay])

  const handleChannelSelect = useCallback(
    (id: string): void => {
      void navigate({ to: '/channel/$channelId', params: { channelId: id } })
    },
    [navigate],
  )

  const handleSurfToggle = useCallback((): void => {
    if (isSurfing) {
      stopSurf()
    } else {
      startSurf()
    }
  }, [isSurfing, stopSurf, startSurf])

  // Dwell adjustment reads dwellSeconds via ref inside the hook, so no
  // stale-closure risk — but we still gate on isSurfing here for UX.
  const dwellRef = useRef(dwellSeconds)
  dwellRef.current = dwellSeconds

  const handleDwellIncrease = useCallback((): void => {
    if (!isSurfing) return
    setSurfDwellSeconds(dwellRef.current + 5)
  }, [isSurfing, setSurfDwellSeconds])

  const handleDwellDecrease = useCallback((): void => {
    if (!isSurfing) return
    setSurfDwellSeconds(dwellRef.current - 5)
  }, [isSurfing, setSurfDwellSeconds])

  useKeyboardControls({
    onChannelUp: handleKeyboardChannelUp,
    onChannelDown: handleKeyboardChannelDown,
    onToggleGuide: toggleGuide,
    onToggleMute: handleToggleMute,
    onImport: toggleImport,
    onInfo: handleToggleInfo,
    onHelp: handleHelp,
    onEscape: handleEscape,
    onHome: handleHome,
    onFullscreen: toggleFullscreen,
    onOverlay: handleCycleOverlay,
    onTheater: toggleTheater,
    onVolumeUp: handleVolumeUp,
    onVolumeDown: handleVolumeDown,
    onShare: handleShare,
    onSurfToggle: handleSurfToggle,
    onDwellIncrease: handleDwellIncrease,
    onDwellDecrease: handleDwellDecrease,
    onKeyMatched: trackKeyboardShortcut,
  })

  // Compute a blurred poster thumbnail for the loading state by predicting
  // which video will be playing from the mock channel's schedule.
  const loadingPosterUrl = useMemo(() => {
    if (clientReady && !isLoading) return null
    const mock = buildMockChannel(channelId)
    const pos = getSchedulePosition(mock, new Date())
    return getThumbnailUrl(pos.video)
  }, [clientReady, isLoading, channelId])

  // Loading state (also shown pre-hydration so isMobile is accurate before any player mounts)
  if (!clientReady || isLoading) {
    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
        style={{ backgroundColor: '#050505' }}
      >
        {/* Blurred thumbnail poster */}
        {loadingPosterUrl && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${loadingPosterUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(20px) brightness(0.3)',
              transform: 'scale(1.1)',
            }}
          />
        )}
        <div className="relative z-10 flex flex-col items-center">
          <div
            className="font-mono text-2xl tracking-widest animate-pulse"
            style={{
              color: 'rgba(57,255,20,0.6)',
              fontFamily: MONO,
            }}
          >
            {preset
              ? `CH ${preset.number} — ${preset.name.toUpperCase()}`
              : `CH ${channelId.toUpperCase()}`}
          </div>
          <div
            className="mt-2 font-mono text-sm tracking-wider"
            style={{
              color: 'rgba(255,255,255,0.2)',
              fontFamily: MONO,
            }}
          >
            TUNING IN...
          </div>
        </div>
      </div>
    )
  }

  // Mobile: simplified layout — player + now-playing bar + channel list
  if (isMobile && loadedChannel !== null && position !== null) {
    return (
      <MobileView
        channel={loadedChannel}
        position={position}
        isMuted={isMuted}
        volume={volume}
        isFullscreen={isFullscreen}
        onToggleMute={handleToggleMute}
        onPlay={() => {
          if (!isMuted) toggleMute()
        }}
        onChannelSelect={handleChannelSelect}
        onNextChannel={handleKeyboardChannelDown}
        onPrevChannel={handleKeyboardChannelUp}
        onResync={handleResync}
        onShare={handleShare}
        onCycleOverlay={handleCycleOverlay}
        onFullscreen={toggleFullscreen}
        showStatic={showStatic}
        overlayMode={overlayMode}
        showOverlayToast={showOverlayToast}
        toast={{ visible: toast.visible, message: toast.message, detail: toast.detail }}
        allPresets={allPresets}
        loadedChannels={loadedChannels}
        currentChannelId={channelId}
        surfState={surfState}
        onSurfToggle={handleSurfToggle}
        isSurfing={isSurfing}
      />
    )
  }

  // Should not happen after loading, but satisfies TS
  if (loadedChannel === null || position === null) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center"
        style={{ backgroundColor: '#050505' }}
      >
        <div
          className="font-mono text-xl tracking-widest"
          style={{
            color: 'rgba(255,0,0,0.6)',
            fontFamily: MONO,
          }}
        >
          NO SIGNAL
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="relative flex h-full w-full flex-col"
        style={{ backgroundColor: '#050505' }}
      >
        {/* Player fills available space */}
        <div className="flex-1 min-h-0">
          <TvPlayer
            channel={loadedChannel}
            position={position}
            isMuted={isMuted}
            volume={volume}
            onNeedsInteraction={() => {
              setNeedsInteraction(true)
              if (!isMuted) toggleMute()
            }}
            onResync={handleResync}
          />
          {/* Static burst in the overscan gap around the video */}
          {showStatic && (
            <div
              className="static-burst absolute inset-0 pointer-events-none"
              aria-hidden="true"
              style={{ zIndex: 10 }}
            />
          )}

          {/* Channel surf static + OSD — triggered by keyboard navigation */}
          <ChannelSurfStatic
            channel={surfState.channel}
            showStatic={surfState.showStatic}
            showOsd={surfState.showOsd}
            navigationSource={surfState.navigationSource}
          />
        </div>

        {/* Channel info overlay — top on mobile to avoid controls overlap */}
        {showInfo && (
          <div
            className={`absolute ${isMobile ? 'top-2 left-2 right-2' : 'bottom-4 left-4'} rounded border px-4 py-3`}
            style={{
              backgroundColor: 'rgba(0,0,0,0.85)',
              borderColor: 'rgba(57,255,20,0.4)',
            }}
          >
            <div
              className="font-mono text-lg tracking-widest"
              style={{
                color: '#39ff14',
                fontFamily: MONO,
              }}
            >
              CH {loadedChannel.number} — {loadedChannel.name.toUpperCase()}
            </div>
            <div
              className="mt-1 font-mono text-sm tracking-wider"
              style={{
                color: 'rgba(255,165,0,0.9)',
                fontFamily: MONO,
              }}
            >
              {position.video.title}
            </div>
            <div className="mt-2 flex gap-4">
              <a
                href={`https://www.youtube.com/watch?v=${position.video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs tracking-wider underline"
                style={{
                  color: 'rgba(255,255,255,0.45)',
                  fontFamily: MONO,
                }}
              >
                ▶ WATCH ON YOUTUBE
              </a>
              {loadedChannel.playlistId && (
                <a
                  href={`https://www.youtube.com/playlist?list=${loadedChannel.playlistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs tracking-wider underline"
                  style={{
                    color: 'rgba(255,255,255,0.45)',
                    fontFamily: MONO,
                  }}
                >
                  ☰ VIEW PLAYLIST
                </a>
              )}
            </div>
          </div>
        )}

        {/* Mute prompt — shown when browser blocks autoplay with sound */}
        {needsInteraction && (
          <div
            className={`absolute inset-0 flex items-center justify-center ${isMobile ? 'pointer-events-auto' : 'pointer-events-none'}`}
            onClick={isMobile ? handleToggleMute : undefined}
          >
            <div
              className="rounded border px-6 py-4 font-mono text-lg tracking-widest uppercase"
              style={{
                backgroundColor: 'rgba(0,0,0,0.85)',
                borderColor: 'rgba(57,255,20,0.6)',
                color: '#39ff14',
                fontFamily: MONO,
                cursor: isMobile ? 'pointer' : 'default',
              }}
            >
              {isMobile ? 'TAP TO UNMUTE' : '[M] UNMUTE'}
            </div>
          </div>
        )}

        {/* Volume OSD — appears briefly on any volume/mute change */}
        <VolumeOsd volume={volume} isMuted={isMuted} visible={osdVisible} />

        {/* Surf info bar — visible when channel surf mode is active */}
        <SurfInfoBar
          channel={preset ?? null}
          videoTitle={position.video.title}
          countdown={countdown}
          dwellSeconds={dwellSeconds}
          visible={isSurfing}
          isMobile={isMobile}
          onDwellTap={isMobile ? () => setSurfDwellSeconds((dwellSeconds % 60) + 5) : undefined}
        />

        {/* Share toast — appears briefly when S is pressed */}
        <Toast
          visible={toast.visible}
          message={toast.message}
          detail={toast.detail}
        />

        {/* Static MUTED badge — shown when OSD is not visible and player is muted */}
        {isMuted && !needsInteraction && !osdVisible && (
          <div
            className="absolute top-4 right-4 rounded border px-3 py-1 font-mono text-sm tracking-widest"
            style={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              borderColor: 'rgba(255,165,0,0.5)',
              color: 'rgba(255,165,0,0.9)',
              fontFamily: MONO,
            }}
          >
            MUTED
          </div>
        )}

        {/* API error banner — suppressed when quota exhausted (layout banner covers it) */}
        {loadError !== null && !isQuotaExhausted && (
          <div
            className="absolute top-4 left-4 rounded border px-3 py-1 font-mono text-xs tracking-wider"
            style={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              borderColor: 'rgba(255,50,50,0.4)',
              color: 'rgba(255,100,100,0.8)',
              fontFamily: MONO,
            }}
          >
            DEMO MODE — {loadError}
          </div>
        )}

        {/* Overlay mode toast — shown briefly when V is pressed */}
        {showOverlayToast && (
          <div
            className="absolute bottom-4 right-4 rounded border px-4 py-2 font-mono text-base tracking-widest uppercase"
            style={{
              backgroundColor: 'rgba(0,0,0,0.85)',
              borderColor: 'rgba(57,255,20,0.4)',
              color: '#39ff14',
              fontFamily: MONO,
              zIndex: 60,
            }}
          >
            OVERLAY:{' '}
            {overlayMode === 'none' ? 'OFF' : overlayMode.toUpperCase()}
          </div>
        )}
      </div>

      {/* Keyboard help modal — skip on mobile (no keyboard) */}
      {!isMobile && (
        <>
          <KeyboardHelp visible={showHelp} onClose={() => setShowHelp(false)} />
          <DesktopWelcome visible={needsDesktopOnboarding} onDismiss={dismissDesktopOnboarding} />
        </>
      )}
    </>
  )
}
