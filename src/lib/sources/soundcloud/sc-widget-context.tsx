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
import { decideReconcile } from '~/lib/sources/soundcloud/reconcile'
import type { LoadInFlight } from '~/lib/sources/soundcloud/reconcile'
import {
  trackScRealign,
  trackScTrackUnplayable,
  urlCorrelationId,
} from '~/lib/datadog/rum'
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

// Provider reconcile loop cadence. Cheap: one pure getSchedulePosition + a
// pure decision per tick; widget commands only fire when a correction is due.
const RECONCILE_INTERVAL_MS = 1000

// PLAY_PROGRESS events arriving this soon after load() may be stale in-flight
// messages from the PREVIOUS track. Trusting one would falsely confirm the new
// URL with the old track's position, arming a bogus drift seek or a
// track-mismatch teardown of a genuinely loading track. Real first-progress
// after an SC load() takes well over this window.
const STALE_PROGRESS_WINDOW_MS = 750

// Resolve a widget URL back to the channel track it belongs to, for
// unplayable-track telemetry (the widget's events carry no track identity).
function findTrackByUrl(
  channel: MusicChannel,
  url: string | null,
): Track | undefined {
  if (url === null) return undefined
  return channel.tracks?.find((t) => t.embedUrl === url)
}

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
  // This is *intent* (what we asked the widget to load); reconciliation must
  // use the confirmed refs below instead.
  const currentTrackUrlRef = useRef<string | null>(null)

  // Widget truth: the track URL the widget has actually emitted PLAY_PROGRESS
  // for since the last load(), and the most recent progress position. Null
  // until the first progress event confirms the load.
  const confirmedTrackUrlRef = useRef<string | null>(null)
  const lastProgressSecondsRef = useRef<number | null>(null)
  const loadInFlightRef = useRef<LoadInFlight | null>(null)
  const lastSeekAtMsRef = useRef<number | null>(null)
  // One-shot flag so a dead track only reports retries-exhausted once.
  const retryExhaustedReportedRef = useRef(false)

  const statusRef = useRef<WidgetStatus>('mounting')

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

  // Mirror status into a ref so the reconcile loop can read it without
  // re-subscribing the interval on every status change.
  const updateStatus = useCallback((s: WidgetStatus): void => {
    statusRef.current = s
    setStatus(s)
  }, [])

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
      // Retrying the same unconfirmed URL burns a retry from its budget;
      // any new URL starts fresh (and may report exhaustion again later).
      const prevInFlight = loadInFlightRef.current
      const isRetry = prevInFlight?.url === track.embedUrl
      loadInFlightRef.current = {
        url: track.embedUrl,
        startedAtMs: Date.now(),
        retryCount: isRetry ? prevInFlight.retryCount + 1 : 0,
      }
      if (!isRetry) retryExhaustedReportedRef.current = false
      confirmedTrackUrlRef.current = null
      lastProgressSecondsRef.current = null
      // A settle stamp from the previous track must not suppress the first
      // drift judgement on this one; doSeek re-stamps when this load seeks.
      lastSeekAtMsRef.current = null
      updateStatus('mounting')

      // Mute before load so the widget doesn't audibly play from position 0
      // while we wait for PLAY_PROGRESS to confirm it's ready to seek.
      w.setVolume(0)

      const doSeek = (): void => {
        pendingSeekRef.current = null
        // Guard: channel may have changed while we were loading
        if (activeChannelRef.current?.id !== channelId) return
        const w2 = widgetRef.current
        if (!w2) return
        lastSeekAtMsRef.current = Date.now()
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
    [trackTimer, updateStatus],
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
      updateStatus('ready')
      setIsReady(true)
    })
    w.on('play', () => updateStatus('playing'))
    w.on('pause', () => updateStatus('paused'))
    w.on('error', () => {
      updateStatus('error')
      const live = activeChannelRef.current
      if (!live?.tracks?.length) return
      const nowMs = Date.now()
      if (!canAdvance(advanceStateRef.current, live.tracks.length, nowMs)) return
      advanceStateRef.current = recordAdvance(advanceStateRef.current, nowMs)

      // Emitted post-guard so a tight error loop can't spam RUM. The failed
      // track is whatever we last asked the widget to load.
      const failed = findTrackByUrl(live, currentTrackUrlRef.current)
      if (failed) {
        trackScTrackUnplayable({
          channelId: live.id,
          trackId: failed.id,
          reason: 'widget-error',
          sourceUrlCorrelationId: urlCorrelationId(failed.embedUrl),
        })
      }

      const now = new Date()
      const currentPos = getSchedulePosition(live, now)
      const nextTs = new Date(currentPos.slotEndTime.getTime() + 1000)
      const nextPos = getSchedulePosition(live, nextTs)
      const nextTrack = nextPos.item as Track
      if (nextTrack.embedUrl !== currentTrackUrlRef.current) {
        loadTrack(nextTrack, nextPos.seekSeconds, live.id)
      }
    })
    // Single shared dispatcher. On every PLAY_PROGRESS:
    //   1. record widget truth — the first progress after a load() confirms
    //      that URL is actually playing; every event updates the live position
    //   2. fire the pending one-shot seek callback, then clear it
    w.on('playProgress', (data?: unknown) => {
      const inFlight = loadInFlightRef.current
      // Progress within the stale window belongs to the previous track —
      // record nothing from it (it must not confirm the new URL nor pollute
      // the drift position), but still fall through to the pending seek,
      // which has its own channel guard and a 3s timeout fallback anyway.
      const isStale =
        inFlight !== null &&
        Date.now() - inFlight.startedAtMs < STALE_PROGRESS_WINDOW_MS
      if (!isStale) {
        const msg = data as { currentPosition?: number } | undefined
        lastProgressSecondsRef.current = (msg?.currentPosition ?? 0) / 1000
        if (inFlight) {
          confirmedTrackUrlRef.current = inFlight.url
          loadInFlightRef.current = null
        }
      }
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

      const now = new Date()
      const currentPos = getSchedulePosition(live, now)
      const nextTs = new Date(currentPos.slotEndTime.getTime() + 1000)
      const nextPos = getSchedulePosition(live, nextTs)
      const nextTrack = nextPos.item as Track
      // A late finish from the track load() just replaced must not re-load
      // the URL already in flight — that would burn its load-timeout retry
      // budget and falsely strand a loadable track as dead. Checked before
      // recordAdvance so a skipped late finish doesn't spend the 1.5s
      // advance budget. (No plain same-as-current guard here: single-track
      // channels legitimately reload the same URL on every natural finish.)
      if (loadInFlightRef.current?.url === nextTrack.embedUrl) return
      advanceStateRef.current = recordAdvance(advanceStateRef.current, nowMs)
      loadTrack(nextTrack, nextPos.seekSeconds, live.id)
    })

    const failsafe = setTimeout(() => setIsReady(true), 6000)

    return () => {
      clearTimeout(failsafe)
      cancelPendingTimers()
      w.pause()
      w.dispose()
      widgetRef.current = null
    }
  }, [cancelPendingTimers, loadTrack, updateStatus])

  const setActiveChannel = useCallback(
    (channel: MusicChannel | null): void => {
      cancelPendingTimers()
      pendingSeekRef.current = null
      advanceStateRef.current = { attempts: 0, lastAdvanceMs: 0 }

      if (channel === null) {
        activeChannelRef.current = null
        currentTrackUrlRef.current = null
        // Full widget-truth reset — loadTrack owns these on the load path,
        // and the idempotent same-track path must NOT touch them (a load
        // may be genuinely in flight awaiting its PLAY_PROGRESS confirm).
        confirmedTrackUrlRef.current = null
        lastProgressSecondsRef.current = null
        loadInFlightRef.current = null
        lastSeekAtMsRef.current = null
        retryExhaustedReportedRef.current = false
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

  // Schedule reconciliation. The provider owns a ~1s loop (plus an immediate
  // pass when the tab regains visibility) that compares widget truth against
  // the wall-clock scheduler and corrects reload/seek divergence.
  //
  // Reload corrections are routed THROUGH the advance guard: reconcile and
  // the finish handler share advanceStateRef, so they can never double-load
  // within the 1.5s rapid-loop window. This is also why the loop must never
  // call setActiveChannel — that resets advanceStateRef and would destroy
  // the runaway-advance protection on every tick.
  //
  // The loop never calls play(): a paused/blocked widget decides to noop, and
  // loadTrack's own doSeek path gates play() on navigator.userActivation.
  useEffect(() => {
    if (!activeChannelId) return

    const reconcile = (trigger: 'interval' | 'visibility'): void => {
      const w = widgetRef.current
      const live = activeChannelRef.current
      if (!w || !live?.tracks?.length) return

      const nowMs = Date.now()
      const pos = getSchedulePosition(live, new Date(nowMs))
      const track = pos.item as Track
      const lastSeekAt = lastSeekAtMsRef.current
      const decision = decideReconcile({
        scheduledTrackUrl: track.embedUrl,
        scheduledSeekSeconds: pos.seekSeconds,
        isPlaying: statusRef.current === 'playing',
        confirmedTrackUrl: confirmedTrackUrlRef.current,
        lastProgressSeconds: lastProgressSecondsRef.current,
        loadInFlight: loadInFlightRef.current,
        msSinceLastSeek: lastSeekAt === null ? null : nowMs - lastSeekAt,
        nowMs,
      })

      if (decision.action === 'seek') {
        lastSeekAtMsRef.current = nowMs
        w.seekTo(pos.seekSeconds * 1000)
        trackScRealign('drift', decision.driftSeconds, live.id, trigger)
      } else if (decision.action === 'reload') {
        if (!canAdvanceOnFinish(advanceStateRef.current, nowMs)) return
        advanceStateRef.current = recordAdvance(advanceStateRef.current, nowMs)
        trackScRealign(decision.reason, 0, live.id, trigger)
        loadTrack(track, pos.seekSeconds, live.id)
      } else if (
        decision.reason === 'retries-exhausted' &&
        !retryExhaustedReportedRef.current
      ) {
        retryExhaustedReportedRef.current = true
        const inFlight = loadInFlightRef.current
        const stuck = findTrackByUrl(live, inFlight?.url ?? null)
        trackScTrackUnplayable({
          channelId: live.id,
          trackId: stuck?.id ?? 'unknown',
          reason: 'load-retries-exhausted',
          sourceUrlCorrelationId: urlCorrelationId(inFlight?.url ?? ''),
          retryCount: inFlight?.retryCount ?? 0,
        })
      }
    }

    const intervalId = setInterval(
      () => reconcile('interval'),
      RECONCILE_INTERVAL_MS,
    )
    const onVisibility = (): void => {
      if (!document.hidden) reconcile('visibility')
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [activeChannelId, loadTrack])

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
