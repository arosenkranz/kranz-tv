import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { SoundCloudWidgetWrapper, buildWidgetSrc } from './widget'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import {
  canAdvance,
  canAdvanceOnFinish,
  recordAdvance,
} from '~/lib/sources/soundcloud/advance-guard'
import type { AdvanceState } from '~/lib/sources/soundcloud/advance-guard'
import type { MusicChannel, Track } from '~/lib/scheduling/types'

type WidgetStatus = 'mounting' | 'ready' | 'playing' | 'paused' | 'error'

interface ScWidgetContextValue {
  /** The current widget wrapper, or null if SDK hasn't loaded yet. */
  readonly widget: SoundCloudWidgetWrapper | null
  /** Current high-level status — exposed for status badges. */
  readonly status: WidgetStatus
  /** The id of the music channel the provider is currently driving. */
  readonly activeChannelId: string | null
  /** True once the SC widget has fired READY at least once — safe to load(). */
  readonly isReady: boolean
  /**
   * Single point of control. Calling with a music channel loads the
   * currently-scheduled track (not the whole playlist) and seeks to the
   * live position. Calling with null pauses the widget.
   */
  setActiveChannel: (channel: MusicChannel | null) => void
}

const ScWidgetContext = createContext<ScWidgetContextValue | null>(null)

// How long to wait for PLAY_PROGRESS after load() before forcing seekTo anyway.
const SEEK_TIMEOUT_MS = 3000

/**
 * Owns one persistent SoundCloud widget iframe for the entire session.
 *
 * Single-track architecture: instead of loading a whole playlist and trying
 * to sync the widget's internal playlist state with our scheduler, we load
 * exactly one track URL at a time. The scheduler is the sole source of truth
 * for which track is playing — the widget is just an audio player we point
 * at a single track URL + seek position.
 *
 * Flow on channel load or track change:
 *   1. getSchedulePosition() → which track, at what seek position
 *   2. w.load(track.embedUrl, { auto_play: true }) — loads that track URL
 *   3. First PLAY_PROGRESS fires → seekTo(seekSeconds * 1000)
 *   4. Restore volume + play
 *
 * On finish (track ends naturally): advance to next track via the same flow.
 */
export function ScWidgetProvider({
  children,
  isMuted,
  volume,
}: {
  children: React.ReactNode
  isMuted?: boolean
  volume?: number
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const widgetRef = useRef<SoundCloudWidgetWrapper | null>(null)
  const [widget, setWidget] = useState<SoundCloudWidgetWrapper | null>(null)
  const [status, setStatus] = useState<WidgetStatus>('mounting')
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Current loaded track URL — used for idempotency so we don't reload the same
  // track on every render tick when the scheduler returns the same position.
  const currentTrackUrlRef = useRef<string | null>(null)

  const activeChannelRef = useRef<MusicChannel | null>(null)
  const isMutedRef = useRef(isMuted ?? false)
  isMutedRef.current = isMuted ?? false
  const volumeRef = useRef(volume ?? 80)
  volumeRef.current = volume ?? 80

  // Pending timers — cancelled on each setActiveChannel call so stale
  // deferred play() commands cannot fire after channel navigation.
  const pendingTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  // One-shot callback dispatched by the shared playProgress listener.
  // Set to doSeek before load(); cleared after it fires once.
  const pendingSeekRef = useRef<(() => void) | null>(null)

  // Shared auto-advance budget for finish + error handlers.
  // Reset on setActiveChannel so each new channel gets a fresh budget.
  const advanceStateRef = useRef<AdvanceState>({ attempts: 0, lastAdvanceMs: 0 })

  const cancelPendingTimers = useCallback((): void => {
    for (const t of pendingTimersRef.current) clearTimeout(t)
    pendingTimersRef.current.clear()
  }, [])

  const trackTimer = useCallback((delay: number, fn: () => void): void => {
    const id = setTimeout(() => {
      pendingTimersRef.current.delete(id)
      fn()
    }, delay)
    pendingTimersRef.current.add(id)
  }, [])

  // loadTrack: load a single track URL and seek to seekSeconds.
  // Called on channel change AND on natural track finish (to advance).
  const loadTrack = useCallback(
    (track: Track, seekSeconds: number, channelId: string): void => {
      const w = widgetRef.current
      if (!w) return

      currentTrackUrlRef.current = track.embedUrl
      setStatus('mounting')

      // Mute before load so the widget doesn't audibly play from position 0
      // while we wait for PLAY_PROGRESS to confirm it's ready to seek.
      w.setVolume(0)

      const doSeek = (): void => {
        pendingSeekRef.current = null
        // Guard: channel may have changed while we were loading
        if (activeChannelRef.current?.id !== channelId) return
        const w2 = widgetRef.current
        if (!w2) return
        w2.seekTo(seekSeconds * 1000)
        if (!isMutedRef.current) {
          // Auto-play only if the browser has a prior user activation
          // (any prior tap in this session). MusicChannelView handles
          // the unmute button for strict-autoplay browsers.
          if (navigator.userActivation.isActive) {
            w2.setVolume(volumeRef.current)
            w2.play()
          }
        }
      }

      pendingSeekRef.current = doSeek
      // Fallback: if PLAY_PROGRESS never fires (muted browser, blocked track),
      // seek anyway so we're not stuck silent forever.
      trackTimer(SEEK_TIMEOUT_MS, () => {
        if (pendingSeekRef.current === doSeek) doSeek()
      })

      // auto_play:true so the widget immediately fetches and starts the track,
      // which is what triggers PLAY_PROGRESS.
      w.load(track.embedUrl, { auto_play: true })
    },
    [trackTimer],
  )

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    // Bootstrap with a stable SC track so the SDK has a real SC document to
    // bind to. auto_play=false keeps it silent.
    iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
      'https://api.soundcloud.com/tracks/293',
    )}&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false`

    const w = new SoundCloudWidgetWrapper(iframe)
    widgetRef.current = w
    setWidget(w)

    w.on('ready', () => {
      setStatus('ready')
      setIsReady(true)
    })
    w.on('play', () => setStatus('playing'))
    w.on('pause', () => setStatus('paused'))
    w.on('error', () => {
      setStatus('error')
      const live = activeChannelRef.current
      if (!live?.tracks?.length) return
      const nowMs = Date.now()
      if (!canAdvance(advanceStateRef.current, live.tracks.length, nowMs)) return
      advanceStateRef.current = recordAdvance(advanceStateRef.current, nowMs)

      const now = new Date()
      const currentPos = getSchedulePosition(live, now)
      const nextTs = new Date(currentPos.slotEndTime.getTime() + 1000)
      const nextPos = getSchedulePosition(live, nextTs)
      const nextTrack = nextPos.item as Track
      if (nextTrack.embedUrl !== currentTrackUrlRef.current) {
        loadTrack(nextTrack, nextPos.seekSeconds, live.id)
      }
    })
    // Single shared dispatcher: fires the pending one-shot seek callback on
    // the first PLAY_PROGRESS after each load(), then clears itself.
    w.on('playProgress', () => {
      const fn = pendingSeekRef.current
      if (fn) {
        pendingSeekRef.current = null
        fn()
      }
    })
    // Advance to next track when the current one finishes naturally.
    w.on('finish', () => {
      const live = activeChannelRef.current
      if (!live?.tracks?.length) return
      const nowMs = Date.now()
      // Finish is the happy path — bound only by the rapid-loop interval so a
      // long session can advance through the playlist indefinitely.
      if (!canAdvanceOnFinish(advanceStateRef.current, nowMs)) return
      advanceStateRef.current = recordAdvance(advanceStateRef.current, nowMs)

      const now = new Date()
      const currentPos = getSchedulePosition(live, now)
      const nextTs = new Date(currentPos.slotEndTime.getTime() + 1000)
      const nextPos = getSchedulePosition(live, nextTs)
      loadTrack(nextPos.item as Track, nextPos.seekSeconds, live.id)
    })

    const failsafe = setTimeout(() => setIsReady(true), 6000)

    return () => {
      clearTimeout(failsafe)
      cancelPendingTimers()
      w.pause()
      w.dispose()
      widgetRef.current = null
    }
  }, [cancelPendingTimers, loadTrack])

  const setActiveChannel = useCallback(
    (channel: MusicChannel | null): void => {
      cancelPendingTimers()
      pendingSeekRef.current = null
      advanceStateRef.current = { attempts: 0, lastAdvanceMs: 0 }

      if (channel === null) {
        activeChannelRef.current = null
        currentTrackUrlRef.current = null
        setActiveChannelId(null)
        widgetRef.current?.pause()
        return
      }

      const sameChannel = activeChannelRef.current?.id === channel.id
      activeChannelRef.current = channel
      setActiveChannelId(channel.id)

      if (!widgetRef.current || !channel.tracks?.length) return

      // Compute the live position from our scheduler — pure, deterministic.
      const livePos = getSchedulePosition(channel, new Date())
      const track = livePos.item as Track

      // Idempotent: same channel AND same track URL → no reload.
      // This handles theater-mode toggles, guide open/close, etc.
      if (sameChannel && currentTrackUrlRef.current === track.embedUrl) return

      loadTrack(track, livePos.seekSeconds, channel.id)
    },
    [cancelPendingTimers, loadTrack],
  )

  // Apply mute/volume changes. Does NOT call play() — that is exclusively
  // owned by the doSeek() path in loadTrack to avoid racing the load sequence.
  useEffect(() => {
    const w = widgetRef.current
    if (!w || !activeChannelId) return
    if (isMuted) {
      w.setVolume(0)
      w.pause()
    } else {
      w.setVolume(volume ?? 80)
    }
  }, [isMuted, volume, activeChannelId])

  // Reading the URL query during render diverges the server (always false, so
  // the iframe renders off-screen) from a client with ?debug-sc (visible),
  // which changes the iframe's style/aria-hidden and causes a hydration
  // mismatch. Resolve after mount so SSR and the first client render agree.
  const [debugIframe, setDebugIframe] = useState(false)
  useEffect(() => {
    setDebugIframe(new URLSearchParams(window.location.search).has('debug-sc'))
  }, [])

  return (
    <ScWidgetContext.Provider
      value={{
        widget,
        status,
        activeChannelId,
        isReady,
        setActiveChannel,
      }}
    >
      {children}
      {/*
        Kept at full opacity but translated off-screen. opacity:0 or
        display:none causes Chrome to throttle the iframe's script thread,
        silently dropping play() calls until the window is resized.
      */}
      <iframe
        ref={iframeRef}
        title="SoundCloud Player"
        sandbox="allow-scripts allow-same-origin allow-popups"
        allow="autoplay; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: debugIframe ? 480 : 320,
          height: debugIframe ? 160 : 80,
          opacity: 1,
          pointerEvents: debugIframe ? 'auto' : 'none',
          zIndex: debugIframe ? 9999 : 0,
          border: debugIframe ? '2px solid #ff5500' : 'none',
          transform: debugIframe ? 'none' : 'translate(150%, 150%)',
        }}
        aria-hidden={!debugIframe}
      />
    </ScWidgetContext.Provider>
  )
}

export function useScWidget(): ScWidgetContextValue {
  const ctx = useContext(ScWidgetContext)
  if (!ctx) {
    throw new Error('useScWidget must be used within ScWidgetProvider')
  }
  return ctx
}

export { buildWidgetSrc }
