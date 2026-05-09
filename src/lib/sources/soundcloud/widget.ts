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
  bind: (event: string, cb: EventCallback) => void
  unbind: (event: string) => void
  load: (
    url: string,
    options?: Record<string, unknown>,
    callback?: () => void,
  ) => void
  play: () => void
  pause: () => void
  seekTo: (positionMs: number) => void
  setVolume: (volume: number) => void
  next: () => void
  prev: () => void
  skip: (soundIndex: number) => void
  getSounds: (callback: (sounds: SoundData[]) => void) => void
  getCurrentSound: (callback: (sound: SoundData | null) => void) => void
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
   * Wait until the iframe is actually serving the SC document. The most
   * reliable signal is *receiving* a postMessage from the SC origin —
   * SC's player JS posts init messages to its parent. We also poll the
   * iframe's contentDocument: when same-origin access throws (cross-origin
   * SecurityError), the iframe has navigated to SC.
   */
  private waitForScDocument(): Promise<void> {
    return new Promise((resolve) => {
      let settled = false
      // Declared up-front so settle() can clear them even if it fires
      // before the timers are assigned (e.g. immediate cross-origin success).
      let pollTimer: ReturnType<typeof setInterval> | null = null
      let hardTimer: ReturnType<typeof setTimeout> | null = null

      const settle = (): void => {
        if (settled) return
        settled = true
        window.removeEventListener('message', onMessage)
        this.iframe.removeEventListener('load', onLoad)
        if (pollTimer !== null) clearInterval(pollTimer)
        if (hardTimer !== null) clearTimeout(hardTimer)
        // Give SC one extra tick to be ready for SDK wrapping
        setTimeout(resolve, 100)
      }
      const onMessage = (e: MessageEvent): void => {
        if (e.origin === SC_WIDGET_ORIGIN) settle()
      }
      const onLoad = (): void => settle()

      // Poll: try to read contentDocument. Same-origin success means still
      // about:blank. SecurityError (or null contentDocument) means cross-origin
      // navigation completed → SC is loaded.
      const isCrossOrigin = (): boolean => {
        try {
          const doc = this.iframe.contentDocument
          return doc === null
        } catch {
          return true
        }
      }
      // Check immediately — may already be loaded
      if (isCrossOrigin()) {
        settle()
        return
      }

      pollTimer = setInterval(() => {
        if (isCrossOrigin()) settle()
      }, 100)

      window.addEventListener('message', onMessage)
      this.iframe.addEventListener('load', onLoad)
      // Hard timeout — fail open and let safeCall suppress any subsequent errors
      hardTimer = setTimeout(settle, 8000)
    })
  }

  /** Wrap every widget call so SDK postMessage failures don't bubble up. */
  private safeCall(fn: () => void): void {
    try {
      fn()
    } catch (err) {
      // SDK postMessage to about:blank or null contentWindow — log once, swallow
      console.warn('[SoundCloudWidgetWrapper] suppressed:', err)
    }
  }

  private async init(): Promise<void> {
    try {
      const SCWidget = await loadSdk()
      if (this.disposed) return

      await this.waitForScDocument()
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- disposed may flip during await
      if (this.disposed) return

      // SDK constructor itself can throw if the iframe was navigated away
      this.safeCall(() => {
        this.widget = SCWidget(this.iframe)
      })
      if (!this.widget) return

      // Re-attach any listeners requested before the SDK loaded
      for (const { event, cb } of this.pendingListeners) {
        const sdkEvent = window.SC!.Widget.Events[EVENT_NAME_MAP[event]]
        this.safeCall(() => this.widget!.bind(sdkEvent, cb))
      }
      this.pendingListeners = []

      // Replay any commands queued before the SDK loaded
      for (const cmd of this.pendingCommands) this.safeCall(cmd)
      this.pendingCommands = []
    } catch (err) {
      console.warn('[SoundCloudWidgetWrapper] SDK init failed:', err)
    }
  }

  on(event: WidgetEventName, callback: EventCallback): void {
    // Wrap user callback so any throw inside their handler doesn't bubble
    // into React's render cycle via the SDK's event dispatcher.
    const safeCallback: EventCallback = (data) => {
      try {
        callback(data)
      } catch (err) {
        console.warn(
          `[SoundCloudWidgetWrapper] '${event}' callback threw:`,
          err,
        )
      }
    }
    if (!this.widget) {
      this.pendingListeners.push({ event, cb: safeCallback })
      return
    }
    const sdkEvent = window.SC!.Widget.Events[EVENT_NAME_MAP[event]]
    this.safeCall(() => this.widget!.bind(sdkEvent, safeCallback))
  }

  off(event: WidgetEventName): void {
    if (!this.widget) return
    const sdkEvent = window.SC!.Widget.Events[EVENT_NAME_MAP[event]]
    this.safeCall(() => this.widget!.unbind(sdkEvent))
  }

  private run(fn: (w: ScWidget) => void): void {
    if (this.widget) {
      this.safeCall(() => fn(this.widget!))
    } else {
      this.pendingCommands.push(() => {
        if (this.widget) fn(this.widget)
      })
    }
  }

  /**
   * Swap the playlist URL on a live widget. Avoids destroying and remounting
   * the iframe — the SDK handles internal teardown of the old playlist and
   * loading of the new one. Far more reliable than per-channel iframes.
   *
   * The optional onLoaded callback fires once the new playlist is fully
   * loaded — use this to skip+seek to the correct position BEFORE any
   * audio plays. Without it, the widget would auto-start at track 0
   * position 0 and you'd hear the wrong audio for ~1 second before drift
   * correction.
   */
  load(
    url: string,
    options: Record<string, unknown> = {},
    onLoaded?: () => void,
  ): void {
    this.run((w) =>
      w.load(
        url,
        {
          auto_play: false,
          hide_related: true,
          show_comments: false,
          show_user: false,
          show_reposts: false,
          visual: false,
          ...options,
        },
        onLoaded,
      ),
    )
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
