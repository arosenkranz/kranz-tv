declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }
}

let apiLoadPromise: Promise<void> | null = null

export function loadYouTubeAPI(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube IFrame API requires a browser environment'))
  }

  if (window.YT?.Player) {
    return Promise.resolve()
  }

  if (apiLoadPromise !== null) {
    return apiLoadPromise
  }

  apiLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = window.onYouTubeIframeAPIReady

    window.onYouTubeIframeAPIReady = () => {
      if (existing) existing()
      resolve()
    }

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = () => {
      apiLoadPromise = null
      reject(new Error('Failed to load YouTube IFrame API script'))
    }

    const firstScript = document.getElementsByTagName('script')[0]
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript)
    } else {
      document.head.appendChild(script)
    }
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
  const { containerId, videoId, startSeconds, onReady, onStateChange, onError } = params

  return loadYouTubeAPI().then(() => {
    return new Promise<YT.Player>((resolve, reject) => {
      const container = document.getElementById(containerId)
      if (!container) {
        reject(new Error(`YouTube player container not found: #${containerId}`))
        return
      }

      const player = new window.YT.Player(containerId, {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: {
          autoplay: 1,
          start: Math.floor(startSeconds),
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event: YT.PlayerEvent) => {
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

      // Safety fallback — some environments never fire onReady
      if (player && typeof player.playVideo === 'function') {
        resolve(player)
      }
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
