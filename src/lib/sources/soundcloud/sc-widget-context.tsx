import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  SoundCloudWidgetWrapper,
  buildWidgetSrc,
} from './widget'

type WidgetStatus = 'mounting' | 'ready' | 'playing' | 'paused' | 'error'

interface ScWidgetContextValue {
  /** The current widget wrapper, or null if SDK hasn't loaded yet. */
  readonly widget: SoundCloudWidgetWrapper | null
  /** Current high-level status — exposed for status badges. */
  readonly status: WidgetStatus
  /** The URL currently loaded in the widget, or null if none. */
  readonly currentUrl: string | null
  /** True once the SC widget has fired READY at least once — safe to load(). */
  readonly isReady: boolean
  /**
   * Swap the widget to a new playlist. The optional onLoaded callback
   * fires once the new playlist is fully loaded — use it to skip+seek
   * to the right position BEFORE any audio plays.
   */
  loadPlaylist: (url: string, onLoaded?: () => void) => void
}

const ScWidgetContext = createContext<ScWidgetContextValue | null>(null)

/**
 * Owns one persistent SoundCloud widget iframe for the entire session.
 * Mounted at the app root. Music channel views consume this context to
 * load/play playlists rather than spawning their own iframes.
 *
 * Single-iframe architecture eliminates the cross-iframe postMessage
 * cross-talk and the per-mount lifecycle race that plagued the previous
 * per-channel-iframe design.
 */
export function ScWidgetProvider({ children }: { children: React.ReactNode }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const widgetRef = useRef<SoundCloudWidgetWrapper | null>(null)
  const [widget, setWidget] = useState<SoundCloudWidgetWrapper | null>(null)
  const [status, setStatus] = useState<WidgetStatus>('mounting')
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

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
      w.pause()
      w.dispose()
      widgetRef.current = null
    }
  }, [])

  const loadPlaylist = (url: string, onLoaded?: () => void): void => {
    const w = widgetRef.current
    if (!w) return

    // Always use SDK's load() — it keeps the iframe contentWindow handle
    // alive across playlist swaps. Never reset iframe.src after the
    // initial bootstrap — that would invalidate the SDK's handle and
    // every subsequent postMessage would fail.
    if (currentUrl !== url) {
      setCurrentUrl(url)
      setStatus('mounting')
    }

    // SC's load() callback isn't always called reliably. Use a timeout
    // as a fallback: 1.5s after load(), assume the playlist has loaded
    // and run the user's onLoaded handler. Idempotent if SC's callback
    // ALSO fires.
    let onLoadedFired = false
    const fireOnce = (): void => {
      if (onLoadedFired) return
      onLoadedFired = true
      onLoaded?.()
    }
    w.load(url, {}, fireOnce)
    setTimeout(fireOnce, 1500)
  }

  // Surface the iframe via a stable mount point. Visually hidden by default,
  // visible in dev when ?debug-sc=1 is on the URL.
  const debugIframe =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debug-sc')

  return (
    <ScWidgetContext.Provider
      value={{ widget, status, currentUrl, isReady, loadPlaylist }}
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
