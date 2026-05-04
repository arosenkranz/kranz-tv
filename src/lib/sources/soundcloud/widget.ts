import type { Track } from '~/lib/scheduling/types'

export const SC_WIDGET_ORIGIN = 'https://w.soundcloud.com'

type WidgetEventName =
  | 'ready'
  | 'play'
  | 'pause'
  | 'finish'
  | 'playProgress'
  | 'error'

interface WidgetMessage {
  method?: string
  value?: unknown
  soundId?: number
  loadProgress?: number
  currentPosition?: number
  relativePosition?: number
}

export interface SoundData {
  id: number
  title?: string
  duration?: number
  permalink_url?: string
  user?: { username?: string }
}

type EventCallback = (data?: unknown) => void

let debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

function debounce(key: string, fn: () => void, ms: number): void {
  const existing = debounceTimers.get(key)
  if (existing !== undefined) clearTimeout(existing)
  debounceTimers.set(key, setTimeout(() => {
    debounceTimers.delete(key)
    fn()
  }, ms))
}

export class SoundCloudWidgetWrapper {
  private iframe: HTMLIFrameElement
  private listeners: Map<WidgetEventName, Set<EventCallback>> = new Map()
  private readonly messageHandler: (event: MessageEvent) => void

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe
    this.messageHandler = this.handleMessage.bind(this)
    window.addEventListener('message', this.messageHandler)
  }

  private handleMessage(event: MessageEvent): void {
    if (event.origin !== SC_WIDGET_ORIGIN) return
    if (!event.data || typeof event.data !== 'string') return

    let msg: WidgetMessage
    try {
      msg = JSON.parse(event.data) as WidgetMessage
    } catch {
      return
    }

    const method = msg.method
    if (!method) return

    const eventName = METHOD_TO_EVENT[method as keyof typeof METHOD_TO_EVENT]
    if (!eventName) return

    const callbacks = this.listeners.get(eventName)
    if (callbacks) {
      for (const cb of callbacks) {
        cb(msg)
      }
    }
  }

  private send(method: string, value?: unknown): void {
    if (!this.iframe.contentWindow) return
    this.iframe.contentWindow.postMessage(
      JSON.stringify({ method, value }),
      SC_WIDGET_ORIGIN,
    )
  }

  on(event: WidgetEventName, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
    this.send('addEventListener', event)
  }

  off(event: WidgetEventName, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback)
  }

  play(): void {
    this.send('play')
  }

  pause(): void {
    this.send('pause')
  }

  seekTo(positionMs: number): void {
    debounce('seekTo', () => this.send('seekTo', positionMs), 250)
  }

  setVolume(volume: number): void {
    this.send('setVolume', volume)
  }

  getSounds(): Promise<SoundData[]> {
    return new Promise((resolve) => {
      const id = `getSounds-${Date.now()}`
      const handler = (event: MessageEvent): void => {
        if (event.origin !== SC_WIDGET_ORIGIN) return
        if (!event.data || typeof event.data !== 'string') return
        let msg: WidgetMessage
        try {
          msg = JSON.parse(event.data) as WidgetMessage
        } catch {
          return
        }
        if (msg.method === 'getSounds') {
          window.removeEventListener('message', handler)
          resolve((msg.value as SoundData[]) ?? [])
        }
      }
      window.addEventListener('message', handler)
      this.send('getSounds')
    })
  }

  dispose(): void {
    window.removeEventListener('message', this.messageHandler)
    this.listeners.clear()
    // Cancel any pending debounced commands
    for (const timer of debounceTimers.values()) clearTimeout(timer)
    debounceTimers = new Map()
  }
}

const METHOD_TO_EVENT: Record<string, WidgetEventName> = {
  ready: 'ready',
  play: 'play',
  pause: 'pause',
  finish: 'finish',
  playProgress: 'playProgress',
  error: 'error',
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
