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
import type { MusicChannel, Track } from '~/lib/scheduling/types'

type WidgetStatus = 'mounting' | 'ready' | 'playing' | 'paused' | 'error'

interface ScWidgetContextValue {
  /** The current widget wrapper, or null if SDK hasn't loaded yet. */
  readonly widget: SoundCloudWidgetWrapper | null
  /** Current high-level status — exposed for status badges. */
  readonly status: WidgetStatus
  /** The URL currently loaded in the widget, or null if none. */
  readonly currentUrl: string | null
  /** The id of the music channel the provider is currently driving. */
  readonly activeChannelId: string | null
  /** True once the SC widget has fired READY at least once — safe to load(). */
  readonly isReady: boolean
  /**
   * Single point of control. Calling with a music channel loads that
   * playlist and orchestrates skip+seek+play to the live schedule
   * position. Calling with null pauses the widget and cancels any
   * pending deferred play timers — used when the active route is not
   * a music channel.
   */
  setActiveChannel: (channel: MusicChannel | null) => void
}

const ScWidgetContext = createContext<ScWidgetContextValue | null>(null)

const LOAD_HYDRATION_DELAY_MS = 1500

/**
 * Owns one persistent SoundCloud widget iframe for the entire session.
 * Mounted at the app root. The provider is the SOLE driver of widget
 * commands (load, play, pause, skip, seek) — consumers describe
 * intent via setActiveChannel() and the provider handles the rest.
 *
 * Single-iframe architecture eliminates the cross-iframe postMessage
 * cross-talk and the per-mount lifecycle race that plagued the previous
 * per-channel-iframe design.
 *
 * Single-driver architecture eliminates the ghost-timer race that
 * occurred when MusicChannelView and the layout's autoplay effect both
 * issued widget commands independently.
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
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Pending timers — cleared on every setActiveChannel call so deferred
  // play() commands from a previous channel cannot fire after the user
  // has navigated away. Trevelyan caught this race during review.
  const pendingTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  // Channel/audio state captured by setActiveChannel callbacks. Refs
  // keep the deferred play() chain reading fresh values without
  // re-binding the effect on every render.
  const activeChannelRef = useRef<MusicChannel | null>(null)
  const isMutedRef = useRef(isMuted ?? false)
  isMutedRef.current = isMuted ?? false
  const volumeRef = useRef(volume ?? 80)
  volumeRef.current = volume ?? 80

  const cancelPendingTimers = useCallback((): void => {
    for (const t of pendingTimersRef.current) clearTimeout(t)
    pendingTimersRef.current.clear()
  }, [])

  const trackTimer = useCallback(
    (delay: number, fn: () => void): void => {
      const id = setTimeout(() => {
        pendingTimersRef.current.delete(id)
        fn()
      }, delay)
      pendingTimersRef.current.add(id)
    },
    [],
  )

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    // Bootstrap with a single short, stable, non-conflicting SC track so the
    // SDK has a real SC document inside the iframe to bind to. SDK.load()
    // requires the iframe to be at the SC origin — about:blank doesn't work.
    // We pick a track URL (not a playlist) so the SDK's later load() of any
    // user playlist is a real swap (different URL, distinct internal state).
    // auto_play=false prevents the bootstrap from making any audio.
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
    w.on('error', () => setStatus('error'))

    // Failsafe: if SC's READY never fires for some reason, unblock boot
    // anyway after 6s. Audio attempts will still happen — they just
    // won't have READY confirmation.
    const failsafe = setTimeout(() => setIsReady(true), 6000)

    return () => {
      clearTimeout(failsafe)
      cancelPendingTimers()
      w.pause()
      w.dispose()
      widgetRef.current = null
    }
  }, [cancelPendingTimers])

  const setActiveChannel = useCallback(
    (channel: MusicChannel | null): void => {
      const w = widgetRef.current

      // Always cancel pending timers first — this kills any deferred play()
      // from a previous setActiveChannel call. Without this, navigating
      // away mid-load would trigger play() against a now-stale channel.
      cancelPendingTimers()

      if (channel === null) {
        activeChannelRef.current = null
        setActiveChannelId(null)
        if (w) w.pause()
        return
      }

      // Idempotent: re-driving the same channel is a no-op (apart from
      // cancelling stale timers, which we always do above).
      const sameChannel = activeChannelRef.current?.id === channel.id
      activeChannelRef.current = channel
      setActiveChannelId(channel.id)

      if (!w || !channel.tracks?.length) return

      if (sameChannel && currentUrl === channel.sourceUrl) return

      setCurrentUrl(channel.sourceUrl)
      setStatus('mounting')

      // Two-phase load: SDK loads the playlist, then once it's live we
      // skip to the right track and seek to the live position. The
      // skip/seek is silent (volume 0) until we're at the right spot,
      // then we restore volume and play.
      const onLoaded = (): void => {
        // Read the active channel from the ref — it may have changed
        // during the load, in which case the timers were cancelled and
        // this callback is now a no-op.
        const live = activeChannelRef.current
        if (!live || live.id !== channel.id) return
        const w2 = widgetRef.current
        if (!w2) return

        const livePos = getSchedulePosition(live, new Date())
        const trackIndex =
          live.tracks?.findIndex((t: Track) => t.id === livePos.item.id) ?? 0

        w2.setVolume(0)
        w2.skip(Math.max(0, trackIndex))

        trackTimer(LOAD_HYDRATION_DELAY_MS, () => {
          const stillActive = activeChannelRef.current
          if (!stillActive || stillActive.id !== channel.id) return
          const w3 = widgetRef.current
          if (!w3) return

          const livePos2 = getSchedulePosition(stillActive, new Date())
          w3.seekTo(livePos2.seekSeconds * 1000)
          if (!isMutedRef.current) {
            // Synthesize gesture so SC's autoplay policy accepts play().
            try {
              document.body.click()
            } catch {
              /* ignore */
            }
            w3.setVolume(volumeRef.current)
            w3.play()
          }
        })
      }

      // Idempotent fallback: if SC's load callback never fires, fire ours
      // anyway after a delay. We use trackTimer so this also gets cancelled
      // on a subsequent setActiveChannel.
      let onLoadedFired = false
      const fireOnce = (): void => {
        if (onLoadedFired) return
        onLoadedFired = true
        onLoaded()
      }
      w.load(channel.sourceUrl, {}, fireOnce)
      trackTimer(LOAD_HYDRATION_DELAY_MS, fireOnce)
    },
    [cancelPendingTimers, trackTimer, currentUrl],
  )

  // Apply mute / volume changes to the live widget when an active channel
  // is in play. Centralising this here means MusicChannelView no longer
  // has to manage widget state — it's purely a view.
  useEffect(() => {
    const w = widgetRef.current
    if (!w) return
    if (!activeChannelId) return
    if (isMuted) {
      w.setVolume(0)
      w.pause()
    } else {
      w.setVolume(volume ?? 80)
      w.play()
    }
  }, [isMuted, volume, activeChannelId])

  // Surface the iframe via a stable mount point. Visually hidden by default,
  // visible in dev when ?debug-sc=1 is on the URL.
  const debugIframe =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debug-sc')

  return (
    <ScWidgetContext.Provider
      value={{
        widget,
        status,
        currentUrl,
        activeChannelId,
        isReady,
        setActiveChannel,
      }}
    >
      {children}
      {/*
        SC widget iframe is kept VISIBLE at full opacity but positioned
        off-screen via translate. This is critical: opacity:0 or
        display:none causes Chrome to mark the iframe as compositor-inert,
        which throttles its script thread and silently drops the play()
        call until the user resizes the window or opens DevTools. A real
        rendered iframe at full opacity gets normal priority — we just
        translate it out of the user's view.
      */}
      <iframe
        ref={iframeRef}
        title="SoundCloud Player"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          position: 'fixed',
          bottom: debugIframe ? 0 : 0,
          right: debugIframe ? 0 : 0,
          width: debugIframe ? 480 : 320,
          height: debugIframe ? 160 : 80,
          opacity: 1,
          pointerEvents: debugIframe ? 'auto' : 'none',
          zIndex: debugIframe ? 9999 : 0,
          border: debugIframe ? '2px solid #ff5500' : 'none',
          // Push off-screen via transform — the iframe still composites
          // and runs at normal priority, but is not visible to the user.
          // Crucially do NOT use opacity:0, display:none, or visibility:hidden:
          // those cause Chrome to throttle the iframe's script thread and
          // silently drop play() calls (manifests as audio only starting
          // after window resize or DevTools open).
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
