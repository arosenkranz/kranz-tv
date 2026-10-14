import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SoundCloudAdapter } from '~/lib/sources/soundcloud/adapter'
import { buildWidgetSrc } from '~/lib/sources/soundcloud/widget'
import type { SoundData } from '~/lib/sources/soundcloud/widget'

// ── Fake SoundCloud widget the wrapper binds to ──────────────────────────────

const SDK_EVENTS = {
  READY: 'READY',
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  FINISH: 'FINISH',
  PLAY_PROGRESS: 'PLAY_PROGRESS',
  ERROR: 'ERROR',
} as const

type Binding = { event: string; cb: (data?: unknown) => void }

interface FakeWidget {
  bindings: Binding[]
  bind: ReturnType<typeof vi.fn>
  unbind: ReturnType<typeof vi.fn>
  load: ReturnType<typeof vi.fn>
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  seekTo: ReturnType<typeof vi.fn>
  setVolume: ReturnType<typeof vi.fn>
  getSounds: ReturnType<typeof vi.fn>
  getCurrentSound: ReturnType<typeof vi.fn>
}

let widget: FakeWidget
let capturedIframes: HTMLIFrameElement[]
let capturedSrc: string[]

function makeSound(id: number, complete = true): SoundData {
  return {
    id,
    title: complete ? `Track ${id}` : undefined,
    duration: complete ? id * 1000 : undefined,
    permalink_url: complete
      ? `https://soundcloud.com/artist/track-${id}`
      : undefined,
    user: { username: 'Artist' },
  }
}

function installSdk(soundsProvider: () => SoundData[]): void {
  capturedIframes = []
  capturedSrc = []
  const ctor = vi.fn((iframe: HTMLIFrameElement) => {
    capturedIframes.push(iframe)
    // jsdom never navigates the iframe; capture the src at construction time
    // (cleanup rewrites it to about:blank before we can assert later)
    capturedSrc.push(iframe.getAttribute('src') ?? '')
    return widget
  })
  ;(ctor as unknown as { Events: typeof SDK_EVENTS }).Events = { ...SDK_EVENTS }
  window.SC = { Widget: ctor as unknown as NonNullable<Window['SC']>['Widget'] }

  widget = {
    bindings: [],
    bind: vi.fn((event: string, cb: (data?: unknown) => void) => {
      widget.bindings.push({ event, cb })
    }),
    unbind: vi.fn(),
    load: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn(),
    setVolume: vi.fn(),
    getSounds: vi.fn((cb: (sounds: SoundData[]) => void) =>
      cb(soundsProvider()),
    ),
    getCurrentSound: vi.fn((cb: (s: SoundData | null) => void) => cb(null)),
  }
}

/** Fire the wrapper's listener for a widget event, as the real SDK would. */
function emitSdkEvent(event: keyof typeof SDK_EVENTS, data?: unknown): void {
  for (const b of widget.bindings) {
    if (b.event === SDK_EVENTS[event]) b.cb(data)
  }
}

let originalContentDocument: PropertyDescriptor | undefined

beforeEach(() => {
  vi.useFakeTimers()
  // jsdom never navigates iframes cross-origin; force waitForScDocument to
  // settle immediately so the widget is constructed deterministically.
  originalContentDocument = Object.getOwnPropertyDescriptor(
    HTMLIFrameElement.prototype,
    'contentDocument',
  )
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
    configurable: true,
    get: () => null,
  })
  installSdk(() => [])
})

afterEach(() => {
  if (originalContentDocument) {
    Object.defineProperty(
      HTMLIFrameElement.prototype,
      'contentDocument',
      originalContentDocument,
    )
  }
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete window.SC
  document.body.innerHTML = ''
})

/** Wrapper init: loadSdk resolve → cross-origin settle → +100ms → widget live. */
async function flushWidgetReady(): Promise<void> {
  await vi.advanceTimersByTimeAsync(200)
}

describe('SoundCloudAdapter metadata', () => {
  it('identifies itself as the soundcloud source', () => {
    expect(SoundCloudAdapter.id).toBe('soundcloud')
    expect(SoundCloudAdapter.displayName).toBe('SoundCloud')
  })

  it('matches only https SoundCloud URLs', () => {
    expect(
      SoundCloudAdapter.matchesUrl('https://soundcloud.com/a/sets/b'),
    ).toBe(true)
    expect(SoundCloudAdapter.matchesUrl('https://m.soundcloud.com/a')).toBe(
      true,
    )
    expect(SoundCloudAdapter.matchesUrl('https://on.soundcloud.com/xyz')).toBe(
      true,
    )
    expect(
      SoundCloudAdapter.matchesUrl('https://youtube.com/playlist?x=1'),
    ).toBe(false)
    expect(SoundCloudAdapter.matchesUrl('http://soundcloud.com/a')).toBe(false)
    expect(SoundCloudAdapter.matchesUrl('not-a-url')).toBe(false)
    expect(SoundCloudAdapter.matchesUrl('')).toBe(false)
  })
})

describe('SoundCloudAdapter.createPlayer', () => {
  it('throws — the widget provider owns music playback directly', () => {
    expect(() =>
      SoundCloudAdapter.createPlayer({
        container: document.body,
        sourceUrl: 'https://soundcloud.com/a/sets/b',
      }),
    ).toThrow('SoundCloud createPlayer not yet implemented')
  })
})

describe('SoundCloudAdapter.importPlaylist', () => {
  const PLAYLIST_URL = 'https://soundcloud.com/artist/sets/playlist'

  it('resolves complete sounds into tracks with summed durations', async () => {
    const sounds = [makeSound(150), makeSound(90)]
    installSdk(() => sounds)
    const pending = SoundCloudAdapter.importPlaylist(PLAYLIST_URL)
    await flushWidgetReady()

    // The import iframe is a hidden, sandboxed widget embed of the playlist
    expect(capturedIframes).toHaveLength(1)
    const iframe = capturedIframes[0]
    expect(capturedSrc[0]).toBe(buildWidgetSrc(PLAYLIST_URL))
    expect(iframe.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox',
    )
    // (jsdom does not reflect the `allow` / `referrerPolicy` properties as
    // attributes, so those assignments are not asserted here)
    expect(iframe.style.visibility).toBe('hidden')
    expect(iframe.style.position).toBe('absolute')

    emitSdkEvent('READY')
    // First poll tick fetches sounds and resolves
    await vi.advanceTimersByTimeAsync(250)
    const result = await pending

    expect(result.title).toBe('')
    expect(result.tracks).toHaveLength(2)
    expect(result.tracks[0]).toEqual({
      id: '150',
      title: 'Track 150',
      artist: 'Artist',
      durationSeconds: 150,
      embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent('https://soundcloud.com/artist/track-150')}`,
    })
    expect(result.tracks[1].durationSeconds).toBe(90)
    expect(result.totalDurationSeconds).toBe(240)

    // Cleanup: iframe torn down and widget disposed
    expect(document.body.contains(iframe)).toBe(false)
    expect(widget.unbind).toHaveBeenCalledTimes(6)
  })

  it('truncates oversized playlists to MAX_TRACKS (50) instead of failing', async () => {
    const sounds = Array.from({ length: 60 }, (_, i) => makeSound(i + 1))
    installSdk(() => sounds)
    const pending = SoundCloudAdapter.importPlaylist(PLAYLIST_URL)
    await flushWidgetReady()
    emitSdkEvent('READY')
    await vi.advanceTimersByTimeAsync(250)
    const result = await pending
    expect(result.tracks).toHaveLength(50)
    expect(result.tracks[49].id).toBe('50')
    expect(result.totalDurationSeconds).toBe(
      sounds.slice(0, 50).reduce((sum, s) => sum + (s.duration ?? 0) / 1000, 0),
    )
  })

  it('keeps polling until every considered sound has complete metadata', async () => {
    let call = 0
    installSdk(() => {
      call++
      // First poll: an incompletely-hydrated sound (duration missing)
      // Second poll: fully hydrated
      return call === 1
        ? [makeSound(10), makeSound(20, false)]
        : [makeSound(10), makeSound(20)]
    })
    const pending = SoundCloudAdapter.importPlaylist(PLAYLIST_URL)
    await flushWidgetReady()
    emitSdkEvent('READY')
    await vi.advanceTimersByTimeAsync(250)
    // Not resolved yet — metadata incomplete on the first tick
    let resolved = false
    void pending.then(() => {
      resolved = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(resolved).toBe(false)
    await vi.advanceTimersByTimeAsync(250)
    const result = await pending
    expect(result.tracks).toHaveLength(2)
    expect(widget.getSounds).toHaveBeenCalledTimes(2)
  })

  it('keeps polling while getSounds reports no sounds', async () => {
    installSdk(() => [])
    const pending = SoundCloudAdapter.importPlaylist(PLAYLIST_URL)
    pending.catch(() => {}) // observed below via rejects; avoid unhandled noise
    await flushWidgetReady()
    emitSdkEvent('READY')
    await vi.advanceTimersByTimeAsync(750) // three poll ticks, all empty
    expect(widget.getSounds).toHaveBeenCalledTimes(3)
  })

  it('rejects with PLAYLIST_NOT_FOUND when the widget errors', async () => {
    const sounds = [makeSound(1)]
    installSdk(() => sounds)
    const pending = SoundCloudAdapter.importPlaylist(PLAYLIST_URL)
    await flushWidgetReady()
    emitSdkEvent('ERROR')
    await expect(pending).rejects.toThrow('PLAYLIST_NOT_FOUND')
    expect(document.body.contains(capturedIframes[0])).toBe(false)
    expect(widget.unbind).toHaveBeenCalledTimes(6)
  })

  it('rejects with TIMEOUT when ready never fires within 10s', async () => {
    const sounds = [makeSound(1)]
    installSdk(() => sounds)
    const pending = SoundCloudAdapter.importPlaylist(PLAYLIST_URL)
    await flushWidgetReady()
    // flushWidgetReady already advanced 200ms of the 10s budget
    await vi.advanceTimersByTimeAsync(9_799) // now at 9_999ms — still within budget
    let rejected = false
    void pending.catch(() => {
      rejected = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(rejected).toBe(false)
    await vi.advanceTimersByTimeAsync(1) // crosses IMPORT_TIMEOUT_MS
    await expect(pending).rejects.toThrow('TIMEOUT')
    expect(document.body.contains(capturedIframes[0])).toBe(false)
  })

  it('stops polling after an error — the poll interval is cleaned up', async () => {
    const sounds = [makeSound(1)]
    installSdk(() => sounds)
    const pending = SoundCloudAdapter.importPlaylist(PLAYLIST_URL)
    pending.catch(() => {})
    await flushWidgetReady()
    emitSdkEvent('READY')
    await vi.advanceTimersByTimeAsync(250)
    emitSdkEvent('ERROR')
    const pollCount = widget.getSounds.mock.calls.length
    await vi.advanceTimersByTimeAsync(2_000)
    expect(widget.getSounds.mock.calls.length).toBe(pollCount)
  })

  it('clears the import timeout once sounds resolve — no late TIMEOUT rejection', async () => {
    const sounds = [makeSound(1)]
    installSdk(() => sounds)
    const pending = SoundCloudAdapter.importPlaylist(PLAYLIST_URL)
    await flushWidgetReady()
    emitSdkEvent('READY')
    await vi.advanceTimersByTimeAsync(250)
    const result = await pending
    expect(result.tracks).toHaveLength(1)
    // Advance far past the import timeout — promise stays resolved
    await vi.advanceTimersByTimeAsync(20_000)
    await expect(pending).resolves.toBe(result)
  })
})
