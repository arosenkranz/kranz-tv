import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
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
import { MobileView } from '~/components/mobile-view'
import { channelToPreset } from '~/lib/import/schema'
import type { Channel } from '~/lib/scheduling/types'
import type { ChannelPreset } from '~/lib/channels/types'

const MONO = "'VT323', 'Courier New', monospace"

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
    cycleOverlay,
    overlayMode,
    isMuted,
    toggleMute,
    isMobile,
    isQuotaExhausted,
    setQuotaExhausted,
  } = useTvLayout()

  // Immediately update layout's currentChannelId when the route changes — before
  // channel data loads — so the toolbar and guide reflect the correct channel instantly.
  useEffect(() => {
    setCurrentChannelId(channelId)
  }, [channelId, setCurrentChannelId])

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
  useEffect(() => { setClientReady(true) }, [])

  const preset = CHANNEL_PRESETS.find((p) => p.id === channelId)

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showStatic, setShowStatic] = useState(false)
  const staticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showOverlayToast, setShowOverlayToast] = useState(false)
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
    () => [
      ...CHANNEL_PRESETS,
      ...customChannels.map(channelToPreset),
    ],
    [customChannels],
  )

  const position = useCurrentProgram(loadedChannel)
  const { nextChannel, prevChannel } = useChannelNavigation(
    channelId,
    allChannels,
  )

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
        stored.find((c) => c.id === channelId) ?? loadedChannelsRef.current.get(channelId)
      if (customChannel !== undefined) {
        setFetchedChannel(customChannel)
        setIsLoading(false)
        return
      }
    }

    if (!apiKey || apiKey.trim() === '' || preset === undefined || isQuotaExhausted) {
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
    staticTimerRef.current = setTimeout(() => setShowStatic(false), 520)
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
    setShowHelp(false)
    setShowInfo(false)
  }, [])

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

  useKeyboardControls({
    onChannelUp: prevChannel,
    onChannelDown: nextChannel,
    onToggleGuide: toggleGuide,
    onToggleMute: handleToggleMute,
    onImport: toggleImport,
    onInfo: handleToggleInfo,
    onHelp: handleHelp,
    onEscape: handleEscape,
    onHome: handleHome,
    onFullscreen: toggleFullscreen,
    onOverlay: handleCycleOverlay,
    onTheater: () => {},
  })

  // Loading state (also shown pre-hydration so isMobile is accurate before any player mounts)
  if (!clientReady || isLoading) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center"
        style={{ backgroundColor: '#050505' }}
      >
        <div
          className="font-mono text-2xl tracking-widest animate-pulse"
          style={{
            color: 'rgba(57,255,20,0.6)',
            fontFamily: "'VT323', 'Courier New', monospace",
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
            fontFamily: "'VT323', 'Courier New', monospace",
          }}
        >
          TUNING IN...
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
        onToggleMute={handleToggleMute}
        onPlay={() => { if (!isMuted) toggleMute() }}
        onChannelSelect={handleChannelSelect}
        onResync={handleResync}
        showStatic={showStatic}
        overlayMode={overlayMode}
        allPresets={allPresets}
        loadedChannels={loadedChannels}
        currentChannelId={channelId}
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
            fontFamily: "'VT323', 'Courier New', monospace",
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
                fontFamily: "'VT323', 'Courier New', monospace",
              }}
            >
              CH {loadedChannel.number} — {loadedChannel.name.toUpperCase()}
            </div>
            <div
              className="mt-1 font-mono text-sm tracking-wider"
              style={{
                color: 'rgba(255,165,0,0.9)',
                fontFamily: "'VT323', 'Courier New', monospace",
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
                  fontFamily: "'VT323', 'Courier New', monospace",
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
                    fontFamily: "'VT323', 'Courier New', monospace",
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

        {/* Mute indicator */}
        {isMuted && !needsInteraction && (
          <div
            className="absolute top-4 right-4 rounded border px-3 py-1 font-mono text-sm tracking-widest"
            style={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              borderColor: 'rgba(255,165,0,0.5)',
              color: 'rgba(255,165,0,0.9)',
              fontFamily: "'VT323', 'Courier New', monospace",
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
              fontFamily: "'VT323', 'Courier New', monospace",
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
              fontFamily: "'VT323', 'Courier New', monospace",
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
