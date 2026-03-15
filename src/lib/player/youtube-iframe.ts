declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
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
    if (window.YT?.loaded === 1) {
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

      const firstScript = document.getElementsByTagName('script')[0]
      if (firstScript?.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript)
      } else {
        document.head.appendChild(script)
      }
    }
    // else: script already in DOM — wait for onYouTubeIframeAPIReady to fire
  })

  return apiLoadPromise
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
        },
        events: {
          onReady: (event: YT.PlayerEvent) => {
            clearTimeout(timeout)
            onReady?.(event.target)
            resolve(event.target)
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
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
