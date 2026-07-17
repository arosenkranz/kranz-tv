/// <reference types="youtube" />

declare global {
  interface Window {
    // Only Player is read off window.YT; widen this interface as needed.
    YT: {
      Player: new (
        idOrElement: string | HTMLElement,
        options?: YT.PlayerOptions,
      ) => YT.Player
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiLoadPromise: Promise<void> | null = null
let apiReady = false

export function loadYouTubeAPI(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('YouTube IFrame API requires a browser environment'),
    )
  }

  // Already fully initialized (onYouTubeIframeAPIReady has fired)
  if (apiReady) {
    return Promise.resolve()
  }

  if (apiLoadPromise !== null) {
    return apiLoadPromise
  }

  apiLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = window.onYouTubeIframeAPIReady

    window.onYouTubeIframeAPIReady = () => {
      if (existing) existing()
      apiReady = true
      resolve()
    }

    // If the script already ran and fired the callback before we could hook it
    // (e.g. script was cached by the browser and ran synchronously), resolve now.
    // window.YT is typed as always-present but is injected asynchronously, so it
    // can genuinely be undefined here — read it through an optional view.
    const yt = window.YT as typeof window.YT | undefined
    if (typeof yt?.Player === 'function') {
      apiReady = true
      resolve()
      return
    }

    const existingScript = document.querySelector('script[src*="iframe_api"]')
    if (!existingScript) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.onerror = () => {
        // Remove the failed script so a future retry can re-inject it
        script.remove()
        apiLoadPromise = null
        reject(new Error('Failed to load YouTube IFrame API script'))
      }

      const firstScript = document.getElementsByTagName('script')[0] as
        | HTMLScriptElement
        | undefined
      if (
        firstScript?.parentNode !== null &&
        firstScript?.parentNode !== undefined
      ) {
        firstScript.parentNode.insertBefore(script, firstScript)
      } else {
        document.head.appendChild(script)
      }
    }
    // else: script already in DOM — wait for onYouTubeIframeAPIReady to fire
  })

  return apiLoadPromise
}

// `unloadModule` is a real runtime method on the YouTube player but is absent
// from the community @types/youtube defs, so narrow to it locally rather than
// widening the whole YT.Player type or reaching for `as any`.
interface PlayerWithModules {
  unloadModule?: (name: string) => void
}

/**
 * Force closed captions off. YouTube exposes no player-var to disable captions
 * (`cc_load_policy: 0` only means "don't force them on" — a viewer with captions
 * enabled globally still sees them). The one reliable lever is unloading the
 * caption module at runtime, which must happen on the PLAYING transition because
 * the module isn't instantiated until playback actually starts. `'captions'` is
 * the current module key; `'cc'` is the legacy alias — call both for coverage.
 *
 * Wrapped defensively: the method is undocumented/private and can throw if the
 * module registry isn't ready. A throw here would propagate into YT's event
 * dispatcher, so swallow it — a rendered caption is cosmetic; a crashed player
 * is not.
 */
function disableCaptions(player: YT.Player): void {
  const withModules = player as unknown as PlayerWithModules
  if (typeof withModules.unloadModule !== 'function') return
  try {
    withModules.unloadModule('captions')
    withModules.unloadModule('cc')
  } catch (err) {
    console.warn('Failed to unload YouTube caption module', err)
  }
}

export interface CreatePlayerParams {
  containerId: string
  videoId: string
  startSeconds: number
  onReady?: (player: YT.Player) => void
  onStateChange?: (event: YT.OnStateChangeEvent) => void
  onError?: (event: YT.OnErrorEvent) => void
}

export function createPlayer(params: CreatePlayerParams): Promise<YT.Player> {
  const {
    containerId,
    videoId,
    startSeconds,
    onReady,
    onStateChange,
    onError,
  } = params

  return loadYouTubeAPI().then(() => {
    return new Promise<YT.Player>((resolve, reject) => {
      // YT.Player replaces the container element with an iframe. If a previous
      // player destroyed it, recreate a fresh div so the API has a clean target.
      let container = document.getElementById(containerId)
      if (!container) {
        reject(new Error(`YouTube player container not found: #${containerId}`))
        return
      }

      // If the container is already an iframe (from a prior YT.Player), replace
      // it with a fresh div so the new player has a clean mount point.
      if (container.tagName === 'IFRAME') {
        const fresh = document.createElement('div')
        fresh.id = containerId
        fresh.className = container.className
        container.replaceWith(fresh)
        container = fresh
      }

      const timeout = setTimeout(() => {
        reject(new Error('YouTube player onReady never fired (10s timeout)'))
      }, 10_000)

      new window.YT.Player(containerId, {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          start: Math.floor(startSeconds),
          controls: 1,
          rel: 0,
          playsinline: 1,
          cc_load_policy: 0,
          disablekb: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: (event: YT.PlayerEvent) => {
            clearTimeout(timeout)
            onReady?.(event.target)
            resolve(event.target)
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            // Re-disable captions on every PLAYING transition. The caption
            // module reloads with the viewer's saved preference on each new
            // video (initial load, ENDED-advance, resync, channel switch), and
            // every one funnels through PLAYING — so this is the single durable
            // trigger. Runs before the consumer callback so nothing downstream
            // can observe captions in the on state.
            if (event.data === 1 /* PLAYING */) {
              disableCaptions(event.target)
            }
            onStateChange?.(event)
          },
          onError: (event: YT.OnErrorEvent) => {
            onError?.(event)
          },
        },
      })
    })
  })
}

export function loadVideo(
  player: YT.Player,
  videoId: string,
  startSeconds: number,
): void {
  player.loadVideoById({
    videoId,
    startSeconds: Math.floor(startSeconds),
  })
}
