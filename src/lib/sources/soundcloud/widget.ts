import type { Track } from '~/lib/scheduling/types'

export const SC_WIDGET_ORIGIN = 'https://w.soundcloud.com'
const SC_API_JS = 'https://w.soundcloud.com/player/api.js'

type WidgetEventName =
  | 'ready'
  | 'play'
  | 'pause'
  | 'finish'
  | 'playProgress'
  | 'error'

export interface SoundData {
  id: number
  title?: string
  duration?: number
  permalink_url?: string
  user?: { username?: string }
}

type EventCallback = (data?: unknown) => void

interface ScWidget {
  bind(event: string, cb: EventCallback): void
  unbind(event: string): void
  load(url: string, options?: Record<string, unknown>): void
  play(): void
  pause(): void
  seekTo(positionMs: number): void
  setVolume(volume: number): void
  next(): void
  prev(): void
  skip(soundIndex: number): void
  getSounds(callback: (sounds: SoundData[]) => void): void
  getCurrentSound(callback: (sound: SoundData | null) => void): void
}

interface ScWidgetGlobal {
  (iframe: HTMLIFrameElement | string): ScWidget
  Events: {
    READY: string
    PLAY: string
    PAUSE: string
    FINISH: string
    PLAY_PROGRESS: string
    ERROR: string
  }
}

declare global {
  interface Window {
    SC?: { Widget: ScWidgetGlobal }
  }
}

let sdkPromise: Promise<ScWidgetGlobal> | null = null

/** Loads SoundCloud's widget SDK once and caches the promise. */
function loadSdk(): Promise<ScWidgetGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('SC SDK requires window'))
  }
  if (window.SC?.Widget) return Promise.resolve(window.SC.Widget)
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<ScWidgetGlobal>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SC_API_JS
    script.async = true
    script.onload = () => {
      if (window.SC?.Widget) resolve(window.SC.Widget)
      else reject(new Error('SC SDK loaded but window.SC.Widget missing'))
    }
    script.onerror = () => reject(new Error('Failed to load SC SDK'))
    document.head.appendChild(script)
  })
  return sdkPromise
}

const EVENT_NAME_MAP: Record<WidgetEventName, keyof ScWidgetGlobal['Events']> =
  {
    ready: 'READY',
    play: 'PLAY',
    pause: 'PAUSE',
    finish: 'FINISH',
    playProgress: 'PLAY_PROGRESS',
    error: 'ERROR',
  }

export class SoundCloudWidgetWrapper {
  private iframe: HTMLIFrameElement
  private widget: ScWidget | null = null
  private pendingListeners: Array<{
    event: WidgetEventName
    cb: EventCallback
  }> = []
  private pendingCommands: Array<() => void> = []
  private disposed = false

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe
    void this.init()
  }

  /**
   * Wait until the iframe has loaded its real SC document.
   * If the iframe currently shows about:blank (either it hasn't loaded yet,
   * or a previous mount cleaned it up to about:blank), we must wait for the
   * `load` event before calling SCWidget() — otherwise the SDK wraps the
   * about:blank window and every postMessage throws.
   */
  private waitForScDocument(): Promise<void> {
    return new Promise((resolve) => {
      const isReady = (): boolean => {
        try {
          // contentWindow.location.origin throws cross-origin → that means
          // the iframe IS pointing at SC (cross-origin from us). Good.
          const origin = this.iframe.contentWindow?.location.origin
          // Same-origin access succeeded — must still be about:blank
          return origin !== 'about:blank' && origin !== ''
        } catch {
          // Cross-origin throw = SC document loaded
          return true
        }
      }
      if (isReady()) {
        resolve()
        return
      }
      const onLoad = (): void => {
        this.iframe.removeEventListener('load', onLoad)
        resolve()
      }
      this.iframe.addEventListener('load', onLoad)
    })
  }

  private async init(): Promise<void> {
    try {
      const SCWidget = await loadSdk()
      if (this.disposed) return

      await this.waitForScDocument()
      if (this.disposed) return

      this.widget = SCWidget(this.iframe)

      // Re-attach any listeners requested before the SDK loaded
      for (const { event, cb } of this.pendingListeners) {
        const sdkEvent = window.SC!.Widget.Events[EVENT_NAME_MAP[event]]
        this.widget.bind(sdkEvent, cb)
      }
      this.pendingListeners = []

      // Replay any commands queued before the SDK loaded
      for (const cmd of this.pendingCommands) cmd()
      this.pendingCommands = []
    } catch (err) {
      console.error('[SoundCloudWidgetWrapper] SDK init failed:', err)
    }
  }

  on(event: WidgetEventName, callback: EventCallback): void {
    if (!this.widget) {
      this.pendingListeners.push({ event, cb: callback })
      return
    }
    const sdkEvent = window.SC!.Widget.Events[EVENT_NAME_MAP[event]]
    this.widget.bind(sdkEvent, callback)
  }

  off(event: WidgetEventName): void {
    if (!this.widget) return
    const sdkEvent = window.SC!.Widget.Events[EVENT_NAME_MAP[event]]
    this.widget.unbind(sdkEvent)
  }

  private run(fn: (w: ScWidget) => void): void {
    if (this.widget) fn(this.widget)
    else this.pendingCommands.push(() => this.widget && fn(this.widget))
  }

  play(): void {
    this.run((w) => w.play())
  }

  pause(): void {
    this.run((w) => w.pause())
  }

  seekTo(positionMs: number): void {
    this.run((w) => w.seekTo(positionMs))
  }

  skip(soundIndex: number): void {
    this.run((w) => w.skip(soundIndex))
  }

  setVolume(volume: number): void {
    this.run((w) => w.setVolume(volume))
  }

  getSounds(): Promise<SoundData[]> {
    return new Promise((resolve) => {
      this.run((w) => w.getSounds((sounds) => resolve(sounds)))
    })
  }

  dispose(): void {
    this.disposed = true
    const widget = this.widget
    const Events = window.SC?.Widget.Events
    if (widget && Events) {
      // Individual try/catch — if the iframe was already pointed at about:blank
      // before dispose runs, postMessage throws and we want each unbind to fail
      // independently rather than cascade.
      const events = [
        Events.READY,
        Events.PLAY,
        Events.PAUSE,
        Events.FINISH,
        Events.PLAY_PROGRESS,
        Events.ERROR,
      ]
      for (const event of events) {
        try {
          widget.unbind(event)
        } catch {
          // ignore — iframe may already be torn down
        }
      }
    }
    this.widget = null
    this.pendingListeners = []
    this.pendingCommands = []
  }
}

export function buildWidgetSrc(playlistUrl: string): string {
  const params = new URLSearchParams({
    url: playlistUrl,
    auto_play: 'false',
    hide_related: 'true',
    show_comments: 'false',
    show_user: 'false',
    show_reposts: 'false',
    visual: 'false',
  })
  return `${SC_WIDGET_ORIGIN}/player/?${params.toString()}`
}

export function soundDataToTrack(sound: SoundData): Track {
  return {
    id: String(sound.id),
    title: sound.title ?? 'Unknown',
    artist: sound.user?.username ?? '',
    durationSeconds: Math.floor((sound.duration ?? 0) / 1000),
    embedUrl: `${SC_WIDGET_ORIGIN}/player/?url=${encodeURIComponent(sound.permalink_url ?? '')}`,
  }
}
