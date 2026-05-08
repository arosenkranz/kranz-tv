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

    // Initial src is a benign empty SC player. We swap it via widget.load()
    // when the user navigates to a music channel. Setting src here so the
    // iframe begins navigating immediately on mount.
    iframe.src = `${import.meta.env.SSR ? '' : 'https://w.soundcloud.com'}/player/?url=${encodeURIComponent(
      'https://soundcloud.com/discover',
    )}&auto_play=false&visual=false`

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

    // Failsafe: SC sometimes never fires READY on the discover-bootstrap URL
    // (e.g. region-blocked). Treat the widget as ready after 6s anyway so the
    // boot screen doesn't wedge — load() will still work for real playlists.
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
    if (currentUrl === url) {
      onLoaded?.()
      return
    }
    setCurrentUrl(url)
    setStatus('mounting')
    w.load(url, {}, onLoaded)
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
