import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  trackChannelSwitch,
  trackKeyboardShortcut,
  trackShareChannel,
  trackScChannelRetry,
} from '~/lib/datadog/rum'
import { logChannelLoadFailed } from '~/lib/datadog/logs'
import { cyclePreset, cycleIntensity } from '~/lib/visualizers/preset'
import { VISUALIZER_PRESETS, INTENSITY_LEVELS } from '~/lib/visualizers/types'
import { useChannelSurf } from '~/hooks/use-channel-surf'
import { useToast } from '~/hooks/use-toast'
import { copyToClipboard } from '~/lib/clipboard'
import { Toast } from '~/components/toast'
import { ChannelSurfStatic } from '~/components/channel-surf-static'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import { isMusicStub } from '~/lib/channels/channel-state'
import { loadCustomChannels } from '~/lib/storage/local-channels'
import { useCurrentProgram } from '~/hooks/use-current-program'
import { useChannelNavigation } from '~/hooks/use-channel-navigation'
import { useKeyboardControls } from '~/hooks/use-keyboard-controls'
import { useTvLayout } from '~/routes/_tv'
import { TvPlayer } from '~/components/tv-player'
import { MusicChannelView } from '~/components/music-channel-view'
import { SignalLost } from '~/components/signal-lost'
import { KeyboardHelp } from '~/components/keyboard-help'
import { MobileView } from '~/components/mobile/mobile-view'
import { channelToPreset } from '~/lib/import/schema'
import type { Channel, Video } from '~/lib/scheduling/types'
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
  // Music presets: return an empty music channel instead of falling
  // through to the YouTube mock videos. Playing Rick Astley over an SC
  // channel while the real playlist load is in flight (or has failed)
  // is jarring; an empty tracks list lets the SC widget stay paused and
  // the now-playing card render a neutral "Loading…" state.
  if (preset?.kind === 'music') {
    return {
      kind: 'music',
      id: channelId,
      number: preset.number,
      name: preset.name,
      source: 'soundcloud',
      sourceUrl: preset.sourceUrl,
      description: preset.description,
      totalDurationSeconds: 0,
      trackCount: 0,
      tracks: [],
    }
  }
  return {
    kind: 'video',
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
    channelFailed,
    refetchChannel,
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
    isMobile,
    isQuotaExhausted,
    needsDesktopOnboarding,
    dismissDesktopOnboarding,
    activePreset,
    setActivePreset,
    activeIntensity,
    setActiveIntensity,
  } = useTvLayout()

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

  const preset = CHANNEL_PRESETS.find((p) => p.id === channelId)

  // Only used for custom channels and mock fallback — preset channels are
  // always read from the layout's loadedChannels Map (single source of truth).
  const [fetchedChannel, setFetchedChannel] = useState<Channel | null>(null)

  // For preset channels: read from the shared Map — same object the EPG uses.
  // For custom/mock: use the locally fetched result.
  const mapChannel = loadedChannels.get(channelId) ?? null
  const mapChannelIsStub = isMusicStub(mapChannel ?? undefined)
  const loadedChannel =
    preset !== undefined && mapChannel !== null && !mapChannelIsStub
      ? mapChannel
      : fetchedChannel

  const [needsInteraction, setNeedsInteraction] = useState(false)
  // Gate rendering until after hydration so isMobile is accurate.
  // Prevents a desktop TvPlayer from briefly mounting on mobile during the
  // SSR→client handoff (which would inject the YT script prematurely).
  const [clientReady, setClientReady] = useState(false)
  useEffect(() => {
    setClientReady(true)
  }, [])

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showStatic, setShowStatic] = useState(false)
  const staticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showOverlayToast, setShowOverlayToast] = useState(false)
  const toast = useToast()
  const shareDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [retrying, setRetrying] = useState(false)
  const retryCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Per-channel retry attempt counter — reset when the channel changes so the
  // count reflects retries within a single visit, surfacing mashing in RUM.
  const retryAttemptRef = useRef<{ id: string; count: number }>({
    id: channelId,
    count: 0,
  })
  // Channel id whose priority fetch already fired this visit — the resolve
  // effect re-runs on every loadedChannels change, and without this a channel
  // whose fetch failed non-terminally would be re-triggered by every other
  // channel's load event.
  const priorityFetchedRef = useRef<string | null>(null)

  const handleRetry = useCallback((): void => {
    if (retrying) return
    if (retryCooldownRef.current !== null) return
    if (retryAttemptRef.current.id !== channelId) {
      retryAttemptRef.current = { id: channelId, count: 0 }
    }
    retryAttemptRef.current.count += 1
    trackScChannelRetry(channelId, retryAttemptRef.current.count)
    setRetrying(true)
    void refetchChannel(channelId).finally(() => {
      setRetrying(false)
      // Brief cooldown so mashing can't hammer the rate-limited SC API.
      retryCooldownRef.current = setTimeout(() => {
        retryCooldownRef.current = null
      }, 3000)
    })
  }, [retrying, channelId, refetchChannel])

  const handleShare = useCallback((): void => {
    // Block re-entry for 500ms to prevent toast spam from rapid C presses
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

  // Wrap channel navigation for keyboard — set source before navigating
  // so the surf hook knows to trigger the static animation
  const handleKeyboardChannelUp = useCallback((): void => {
    setNavigationSource('keyboard')
    const currentIndex = allChannels.findIndex((c) => c.id === channelId)
    const targetIndex =
      (currentIndex - 1 + allChannels.length) % allChannels.length
    const targetPreset = allPresets.find(
      (p) => p.id === allChannels[targetIndex]?.id,
    )
    if (targetPreset) {
      triggerSurf(targetPreset)
    }
    prevChannel()
  }, [
    setNavigationSource,
    triggerSurf,
    prevChannel,
    allPresets,
    allChannels,
    channelId,
  ])

  const handleKeyboardChannelDown = useCallback((): void => {
    setNavigationSource('keyboard')
    const currentIndex = allChannels.findIndex((c) => c.id === channelId)
    const targetIndex = (currentIndex + 1) % allChannels.length
    const targetPreset = allPresets.find(
      (p) => p.id === allChannels[targetIndex]?.id,
    )
    if (targetPreset) {
      triggerSurf(targetPreset)
    }
    nextChannel()
  }, [
    setNavigationSource,
    triggerSurf,
    nextChannel,
    allPresets,
    allChannels,
    channelId,
  ])

  // Notify layout so the guide and toolbar can reflect the active channel
  useEffect(() => {
    if (loadedChannel !== null) {
      registerChannel(loadedChannel)
    }
  }, [loadedChannel, registerChannel])

  // NOTE: The shared SoundCloud widget is driven from TvLayout (src/routes/_tv.tsx),
  // NOT here. TvLayout is the one component that survives every view-mode change;
  // this route unmounts on theater/guide toggles once the layout swaps chrome, so
  // owning setActiveChannel here reloaded the SC track on every toggle. See the
  // hoisted effect keyed on currentChannel in _tv.tsx for the full rationale.

  // Resolve channel data for this route.
  //
  // Preset channels: the layout's eager fetch is the single source of truth.
  // We never call buildChannel here — doing so creates two independent fetches
  // that can return different playlist orderings and diverge from each other.
  // Instead we just wait for the layout Map to populate.
  //
  // Custom channels: not in the layout's preset loop, so we load them directly
  // from localStorage. No network call needed — they were fully resolved at import.
  //
  // Quota exhausted: fall back to mock so the player stays functional.
  useEffect(() => {
    setFetchedChannel(null)
    setIsLoading(true)
    setLoadError(null)
    setNeedsInteraction(false)

    // Custom channel — read from localStorage directly
    if (preset === undefined) {
      const stored = loadCustomChannels()
      const customChannel =
        stored.find((c) => c.id === channelId) ??
        loadedChannels.get(channelId)
      if (customChannel !== undefined) {
        setFetchedChannel(customChannel)
        setIsLoading(false)
      } else {
        // Unknown channel ID — show mock so the player doesn't hang blank
        setFetchedChannel(buildMockChannel(channelId))
        setIsLoading(false)
      }
      return
    }

    // Quota exhausted — fall back to mock; layout banner informs the user
    if (isQuotaExhausted) {
      setFetchedChannel(buildMockChannel(channelId))
      setIsLoading(false)
      return
    }

    // Preset channel: layout Map is the source of truth.
    // If already populated (cache hit or eager fetch already resolved), use it.
    // Otherwise stay in loading state — the layout's eager fetch will call
    // registerChannel() which updates loadedChannels, re-rendering this
    // component, and the effect below will clear isLoading.
    const existing = loadedChannels.get(channelId)
    const existingIsStub = isMusicStub(existing)
    if (existing !== undefined && !existingIsStub) {
      setIsLoading(false)
      return
    }
    // Still stub/missing: stay loading, but don't just wait for the eager
    // queue to reach this channel — trigger a priority fetch now. The layout
    // dedupes against in-flight fetches, so this never fires a duplicate API
    // call; channelFailed gates it so a terminally-failed channel doesn't
    // refetch in a loop (SignalLost's retry button owns that path); the ref
    // limits it to once per channel visit.
    if (
      !channelFailed(channelId) &&
      priorityFetchedRef.current !== channelId
    ) {
      priorityFetchedRef.current = channelId
      void refetchChannel(channelId)
    }
  }, [
    channelId,
    preset,
    isQuotaExhausted,
    loadedChannels,
    channelFailed,
    refetchChannel,
  ])

  // Clear loading state once the layout Map has a real (non-stub) entry.
  // This is the "waiting for layout fetch" path for preset channels.
  useEffect(() => {
    if (!isLoading) return
    if (preset === undefined) return
    const ch = loadedChannels.get(channelId)
    if (ch === undefined) return
    const chIsStub = isMusicStub(ch)
    if (!chIsStub) {
      setIsLoading(false)
    }
  }, [loadedChannels, channelId, preset, isLoading])

  const handleResync = useCallback((): void => {
    if (staticTimerRef.current !== null) clearTimeout(staticTimerRef.current)
    setShowStatic(true)
    staticTimerRef.current = setTimeout(() => setShowStatic(false), 370)
  }, [])

  // Unmute (not toggle). This is the click-to-unmute affordance and the mobile
  // toolbar's unmute path, so it must be idempotent: the layout's first-gesture
  // handler also sets isMuted=false on the same click, and toggleMute is a
  // non-functional setIsMuted(!isMuted) over captured state — an unconditional
  // flip here can race it back to muted, stranding the user with no way to
  // unmute now that [M] is gone.
  // Mobile toolbar mute button — a genuine two-way toggle, and mobile's only
  // audio control now that the desktop slider is gone.
  const handleToggleMute = useCallback((): void => {
    toggleMute()
    setNeedsInteraction(false)
  }, [toggleMute])

  const handleUnmute = useCallback((): void => {
    if (isMuted) toggleMute()
    setNeedsInteraction(false)
  }, [isMuted, toggleMute])

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
    if (isTheater) {
      toggleTheater()
      return
    }
  }, [
    needsDesktopOnboarding,
    dismissDesktopOnboarding,
    showHelp,
    isTheater,
    toggleTheater,
  ])

  const handleHome = useCallback((): void => {
    void navigate({ to: '/' })
  }, [navigate])

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

  const handleCyclePreset = useCallback((): void => {
    if (loadedChannel?.kind !== 'music') return
    setActivePreset(cyclePreset(activePreset, VISUALIZER_PRESETS))
  }, [loadedChannel, activePreset, setActivePreset])

  const handleCycleIntensity = useCallback((): void => {
    if (loadedChannel?.kind !== 'music') return
    setActiveIntensity(cycleIntensity(activeIntensity, INTENSITY_LEVELS))
  }, [loadedChannel, activeIntensity, setActiveIntensity])

  useKeyboardControls({
    onChannelUp: handleKeyboardChannelUp,
    onChannelDown: handleKeyboardChannelDown,
    onToggleGuide: toggleGuide,
    onImport: toggleImport,
    onHelp: handleHelp,
    onEscape: handleEscape,
    onHome: handleHome,
    onFullscreen: toggleFullscreen,
    onOverlay: handleCycleOverlay,
    onTheater: toggleTheater,
    onShare: handleShare,
    onVisualizerCycle: handleCyclePreset,
    onIntensityCycle: handleCycleIntensity,
    onKeyMatched: trackKeyboardShortcut,
  })

  // Compute a blurred poster thumbnail for the loading state by predicting
  // which video will be playing from the mock channel's schedule.
  const loadingPosterUrl = useMemo(() => {
    // Defer until after hydration. getSchedulePosition(mock, new Date())
    // reads wall-clock time during render, so computing it on the server
    // (and again on the first client render) yields different timestamps —
    // near a schedule boundary that selects a different mock video, producing
    // a different backgroundImage URL and a React hydration mismatch (#74).
    // Returning null until clientReady makes SSR and first paint emit no
    // poster; it fills in once the post-hydration effect flips clientReady.
    if (!clientReady) return null
    if (!isLoading) return null
    const mock = buildMockChannel(channelId)
    const pos = getSchedulePosition(mock, new Date())
    return getThumbnailUrl(pos.item as Video)
  }, [clientReady, isLoading, channelId])

  // Terminal failure — checked BEFORE the loading gate. A failed music stub
  // keeps isLoading true forever, so this must not live inside that gate.
  if (preset?.kind === 'music' && channelFailed(channelId) && !retrying) {
    return (
      <SignalLost
        channelNumber={preset.number}
        channelName={preset.name}
        onRetry={handleRetry}
        retrying={retrying}
      />
    )
  }

  // Loading state (also shown pre-hydration so isMobile is accurate before any player mounts)
  if (!clientReady || isLoading) {
    // Music channels render MusicChannelView in loading mode (position=null):
    // the visualizer idles immediately behind a thinned TUNING static instead
    // of a dead wall of noise. The widget hasn't been pointed at this channel
    // yet, so isActiveChannel is false and tuningPhase yields the "RESOLVING
    // SIGNAL…" state; all track-dependent UI stays hidden until real data
    // arrives and the full MusicChannelView takes over below — the remount at
    // that flip is masked by the overlay's static.
    if (preset?.kind === 'music') {
      const stub = buildMockChannel(channelId)
      return (
        <div
          className="relative h-full w-full overflow-hidden"
          style={{ backgroundColor: '#050505' }}
        >
          {stub.kind === 'music' && (
            <MusicChannelView
              channel={stub}
              position={null}
              isMuted={isMuted}
              volume={volume}
              onUnmute={() => {
                setNeedsInteraction(false)
                if (isMuted) toggleMute()
              }}
              activePreset={activePreset}
              activeIntensity={activeIntensity}
              isMobile={isMobile}
            />
          )}
        </div>
      )
    }

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
        toast={{
          visible: toast.visible,
          message: toast.message,
          detail: toast.detail,
        }}
        allPresets={allPresets}
        loadedChannels={loadedChannels}
        currentChannelId={channelId}
        surfState={surfState}
        activePreset={activePreset}
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

  // Invariant: a music preset must never render a YouTube TvPlayer (the Gangnam
  // regression class). Normal flow can't reach here (a music stub derives
  // loadedChannel=null -> NO SIGNAL at the null guard above), so if it does,
  // it's data corruption — log and fall back to NO SIGNAL rather than play a video.
  if (preset?.kind === 'music' && loadedChannel.kind !== 'music') {
    logChannelLoadFailed(channelId, 'invariant: music preset resolved to non-music channel')
    return (
      <div
        className="relative flex h-full w-full flex-col items-center justify-center"
        style={{ backgroundColor: '#050505' }}
      >
        <div className="font-mono text-2xl tracking-widest" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}>
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
          {loadedChannel.kind === 'music' ? (
            <MusicChannelView
              channel={loadedChannel}
              position={position}
              isMuted={isMuted}
              volume={volume}
              onUnmute={() => {
                setNeedsInteraction(false)
                if (isMuted) toggleMute()
              }}
              activePreset={activePreset}
              activeIntensity={activeIntensity}
              isMobile={false}
            />
          ) : (
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
          )}
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

        {/* Mute prompt — shown when browser blocks autoplay with sound */}
        {needsInteraction && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-auto"
            onClick={handleUnmute}
          >
            <div
              className="rounded border px-6 py-4 font-mono text-lg tracking-widest uppercase"
              style={{
                backgroundColor: 'rgba(0,0,0,0.85)',
                borderColor: 'rgba(57,255,20,0.6)',
                color: '#39ff14',
                fontFamily: MONO,
                cursor: 'pointer',
              }}
            >
              CLICK TO UNMUTE
            </div>
          </div>
        )}

        {/* Share toast — appears briefly when C is pressed */}
        <Toast
          visible={toast.visible}
          message={toast.message}
          detail={toast.detail}
        />

        {/* Static MUTED badge — shown while the player is still muted */}
        {isMuted && !needsInteraction && (
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
        <KeyboardHelp visible={showHelp} onClose={() => setShowHelp(false)} />
      )}
    </>
  )
}
