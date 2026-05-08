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

    // No bootstrap URL. The widget iframe stays at about:blank until the
    // first call to loadPlaylist(). This avoids the "bootstrap session
    // autoplays then ends in PAUSED state" trap where our React state
    // sees stale play/pause events and thinks audio is flowing when it
    // isn't. The first real load() comes from the user navigating to a
    // music channel.
    iframe.src = 'about:blank'

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

    // We're "ready" for boot-screen purposes as soon as the wrapper is
    // constructed — there's nothing to wait for now. Real readiness for
    // playback comes from the actual channel load.
    setIsReady(true)

    return () => {
      w.pause()
      w.dispose()
      widgetRef.current = null
    }
  }, [])

  const loadPlaylist = (url: string, onLoaded?: () => void): void => {
    const w = widgetRef.current
    if (!w) return

    // First load OR URL changed: navigate the iframe to SC and wait for
    // the document to load before calling SDK.load(). On the first call
    // the iframe is at about:blank (no bootstrap), so we use the URL
    // directly as the iframe src.
    const iframe = iframeRef.current
    if (iframe && iframe.src.includes('about:blank')) {
      // Cold start: navigate iframe directly to the SC player URL with
      // this playlist. The SDK will handle the rest once the iframe loads.
      iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false`
      setCurrentUrl(url)
      setStatus('mounting')
      // The wrapper's waitForScDocument will resolve once the iframe is
      // on SC. The user's onLoaded callback fires via the SDK's load()
      // mechanism — we need to bind it to the next ready event.
      if (onLoaded) {
        const onReadyOnce = (): void => {
          w.off('ready')
          // Re-bind the standard ready handler since we just removed it
          w.on('ready', () => {
            setStatus('ready')
            setIsReady(true)
          })
          onLoaded()
        }
        w.on('ready', onReadyOnce)
      }
      return
    }

    if (currentUrl === url) {
      // Same URL — force a refresh load so the load() callback fires.
      w.load(url, {}, onLoaded)
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
