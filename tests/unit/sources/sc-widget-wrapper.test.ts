import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  SoundCloudWidgetWrapper,
  buildWidgetSrc,
  soundDataToTrack,
  SC_WIDGET_ORIGIN,
} from '~/lib/sources/soundcloud/widget'
import type { SoundData } from '~/lib/sources/soundcloud/widget'

// ── Fake SoundCloud SDK globals ───────────────────────────────────────────────

type FakeWidget = {
  bind: ReturnType<typeof vi.fn>
  unbind: ReturnType<typeof vi.fn>
  load: ReturnType<typeof vi.fn>
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  seekTo: ReturnType<typeof vi.fn>
  setVolume: ReturnType<typeof vi.fn>
  next: ReturnType<typeof vi.fn>
  prev: ReturnType<typeof vi.fn>
  skip: ReturnType<typeof vi.fn>
  getSounds: ReturnType<typeof vi.fn>
  getCurrentSound: ReturnType<typeof vi.fn>
}

function makeFakeWidget(overrides: Partial<FakeWidget> = {}): FakeWidget {
  return {
    bind: vi.fn(),
    unbind: vi.fn(),
    load: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn(),
    setVolume: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    skip: vi.fn(),
    getSounds: vi.fn((cb: (sounds: SoundData[]) => void) => cb([])),
    getCurrentSound: vi.fn((cb: (sound: SoundData | null) => void) => cb(null)),
    ...overrides,
  }
}

const SDK_EVENTS = {
  READY: 'READY',
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  FINISH: 'FINISH',
  PLAY_PROGRESS: 'PLAY_PROGRESS',
  ERROR: 'ERROR',
} as const

const SDK_SRC = 'https://w.soundcloud.com/player/api.js'

let widgetInstances: FakeWidget[]
let widgetCtor: ReturnType<typeof vi.fn>

function installSdk(widgetFactory: () => FakeWidget = makeFakeWidget): void {
  widgetInstances = []
  widgetCtor = vi.fn((_iframe: HTMLIFrameElement) => {
    const w = widgetFactory()
    widgetInstances.push(w)
    return w
  })
  // Real SC global shape: Events hangs off the Widget function itself,
  // the production code reads window.SC.Widget.Events.
  ;(widgetCtor as unknown as { Events: typeof SDK_EVENTS }).Events = {
    ...SDK_EVENTS,
  }
  window.SC = {
    Widget: widgetCtor as unknown as NonNullable<Window['SC']>['Widget'],
  }
}

/**
 * Create an iframe whose contentDocument reads as null (jsdom never navigates
 * cross-origin), so waitForScDocument settles on its immediate check instead
 * of polling. Appended to body so that behavior matches a live iframe.
 */
function makeCrossOriginIframe(): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  Object.defineProperty(iframe, 'contentDocument', {
    configurable: true,
    get: () => null,
  })
  return iframe
}

/** Same-origin iframe (jsdom default about:blank) — exercises the poll paths. */
function makeSameOriginIframe(): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  return iframe
}

/** Advance fake time past the post-settle 100ms tick and flush microtasks. */
async function flushInit(ms = 200): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
}

beforeEach(() => {
  vi.useFakeTimers()
  installSdk()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete window.SC
  document.body.innerHTML = ''
  document.head.querySelectorAll(`script[src="${SDK_SRC}"]`).forEach((s) => {
    s.remove()
  })
})

// ── buildWidgetSrc / soundDataToTrack (pure helpers) ──────────────────────────

describe('buildWidgetSrc', () => {
  it('embeds the playlist URL and the tuned player params', () => {
    const src = buildWidgetSrc('https://soundcloud.com/a/sets/b')
    const parsed = new URL(src)
    expect(parsed.origin).toBe(SC_WIDGET_ORIGIN)
    expect(parsed.pathname).toBe('/player/')
    const params = parsed.searchParams
    expect(params.get('url')).toBe('https://soundcloud.com/a/sets/b')
    expect(params.get('auto_play')).toBe('false')
    expect(params.get('hide_related')).toBe('true')
    expect(params.get('show_comments')).toBe('false')
    expect(params.get('show_user')).toBe('false')
    expect(params.get('show_reposts')).toBe('false')
    expect(params.get('visual')).toBe('false')
  })

  it('encodes URLs that carry their own query string', () => {
    const src = buildWidgetSrc('https://soundcloud.com/a?x=1&y=2')
    expect(new URL(src).searchParams.get('url')).toBe(
      'https://soundcloud.com/a?x=1&y=2',
    )
  })
})

describe('soundDataToTrack', () => {
  it('maps a fully-populated sound', () => {
    const track = soundDataToTrack({
      id: 42,
      title: 'Song',
      duration: 195_500,
      permalink_url: 'https://soundcloud.com/artist/song',
      user: { username: 'Artist' },
    })
    expect(track).toEqual({
      id: '42',
      title: 'Song',
      artist: 'Artist',
      durationSeconds: 195, // floor(195.5s)
      embedUrl: `${SC_WIDGET_ORIGIN}/player/?url=${encodeURIComponent('https://soundcloud.com/artist/song')}`,
    })
  })

  it('falls back for missing title, user, duration, and permalink', () => {
    const track = soundDataToTrack({ id: 7 })
    expect(track.title).toBe('Unknown')
    expect(track.artist).toBe('')
    expect(track.durationSeconds).toBe(0)
    expect(track.embedUrl).toBe(`${SC_WIDGET_ORIGIN}/player/?url=`)
  })

  it('rounds sub-second durations down to zero seconds', () => {
    expect(soundDataToTrack({ id: 1, duration: 999 }).durationSeconds).toBe(0)
  })
})

// ── Construction + init ───────────────────────────────────────────────────────

describe('SoundCloudWidgetWrapper construction', () => {
  it('constructs the SDK widget with the iframe once the SC document is ready', async () => {
    const iframe = makeCrossOriginIframe()
    new SoundCloudWidgetWrapper(iframe)
    await flushInit()
    expect(widgetCtor).toHaveBeenCalledTimes(1)
    expect(widgetCtor).toHaveBeenCalledWith(iframe)
  })

  it('does not construct the SDK widget if disposed before init completes', async () => {
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    wrapper.dispose()
    await flushInit()
    expect(widgetCtor).not.toHaveBeenCalled()
  })

  it('swallows a throwing SDK constructor and leaves the wrapper inert', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    installSdk(() => {
      throw new Error('iframe navigated away')
    })
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    await flushInit()
    expect(widgetInstances).toHaveLength(0)
    // Commands issued after the failed init queue harmlessly instead of throwing
    expect(() => wrapper.play()).not.toThrow()
    expect(warn).toHaveBeenCalledWith(
      '[SoundCloudWidgetWrapper] suppressed:',
      expect.any(Error),
    )
  })
})

// ── Event binding ─────────────────────────────────────────────────────────────

describe('SoundCloudWidgetWrapper events', () => {
  it('replays listeners registered before the SDK was ready, with mapped names', async () => {
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    const ready = vi.fn()
    const progress = vi.fn()
    wrapper.on('ready', ready)
    wrapper.on('playProgress', progress)
    // Nothing bound yet — widget not constructed
    expect(widgetInstances).toHaveLength(0)
    await flushInit()
    const widget = widgetInstances[0]
    expect(widget.bind).toHaveBeenCalledTimes(2)
    expect(widget.bind).toHaveBeenCalledWith('READY', expect.any(Function))
    expect(widget.bind).toHaveBeenCalledWith(
      'PLAY_PROGRESS',
      expect.any(Function),
    )
  })

  it('binds immediately once the widget is live', async () => {
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    await flushInit()
    const widget = widgetInstances[0]
    widget.bind.mockClear()
    wrapper.on('finish', vi.fn())
    expect(widget.bind).toHaveBeenCalledWith('FINISH', expect.any(Function))
  })

  it('delivers event data to the user callback', async () => {
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    const seen: unknown[] = []
    wrapper.on('playProgress', (d) => seen.push(d))
    await flushInit()
    const [, boundCb] = widgetInstances[0].bind.mock.calls[0] as [
      string,
      (d?: unknown) => void,
    ]
    boundCb({ currentPosition: 1500 })
    expect(seen).toEqual([{ currentPosition: 1500 }])
  })

  it('swallows a throwing user callback and warns instead of propagating', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    wrapper.on('ready', () => {
      throw new Error('handler bug')
    })
    await flushInit()
    const [, boundCb] = widgetInstances[0].bind.mock.calls[0] as [
      string,
      (d?: unknown) => void,
    ]
    expect(() => boundCb()).not.toThrow()
    expect(warn).toHaveBeenCalledWith(
      "[SoundCloudWidgetWrapper] 'ready' callback threw:",
      expect.any(Error),
    )
  })

  it('unbinds a mapped event when the widget is live', async () => {
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    await flushInit()
    const widget = widgetInstances[0]
    wrapper.off('error')
    expect(widget.unbind).toHaveBeenCalledWith('ERROR')
  })

  it('off() before the widget exists is a no-op', async () => {
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    expect(() => wrapper.off('play')).not.toThrow()
    await flushInit()
    expect(widgetInstances[0].unbind).not.toHaveBeenCalled()
  })
})

// ── Command delegation + queueing ────────────────────────────────────────────

describe('SoundCloudWidgetWrapper commands', () => {
  it('queues commands issued before init and replays them in order', async () => {
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    wrapper.play()
    wrapper.pause()
    wrapper.seekTo(12_000)
    wrapper.skip(3)
    wrapper.setVolume(37)
    wrapper.load('https://soundcloud.com/a/sets/b', { visual: true })
    await flushInit()
    const widget = widgetInstances[0]
    expect(widget.play).toHaveBeenCalledTimes(1)
    expect(widget.pause).toHaveBeenCalledTimes(1)
    expect(widget.seekTo).toHaveBeenCalledWith(12_000)
    expect(widget.skip).toHaveBeenCalledWith(3)
    expect(widget.setVolume).toHaveBeenCalledWith(37)
    expect(widget.load).toHaveBeenCalledWith(
      'https://soundcloud.com/a/sets/b',
      {
        auto_play: false,
        hide_related: true,
        show_comments: false,
        show_user: false,
        show_reposts: false,
        visual: true,
      },
      undefined,
    )
  })

  it('delegates commands directly once the widget is live', async () => {
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    await flushInit()
    const widget = widgetInstances[0]
    wrapper.play()
    wrapper.pause()
    wrapper.seekTo(900)
    wrapper.setVolume(11)
    expect(widget.play).toHaveBeenCalledTimes(1)
    expect(widget.pause).toHaveBeenCalledTimes(1)
    expect(widget.seekTo).toHaveBeenCalledWith(900)
    expect(widget.setVolume).toHaveBeenCalledWith(11)
  })

  it('load() merges caller options over the tuned defaults', async () => {
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    const onLoaded = vi.fn()
    wrapper.load('https://api.soundcloud.com/tracks/1', {}, onLoaded)
    await flushInit()
    expect(widgetInstances[0].load).toHaveBeenCalledWith(
      'https://api.soundcloud.com/tracks/1',
      {
        auto_play: false,
        hide_related: true,
        show_comments: false,
        show_user: false,
        show_reposts: false,
        visual: false,
      },
      onLoaded,
    )
  })

  it('getSounds() resolves with the sounds the SDK reports', async () => {
    const sounds: SoundData[] = [
      { id: 1, title: 'A', duration: 1000 },
      { id: 2, title: 'B', duration: 2000 },
    ]
    installSdk(() =>
      makeFakeWidget({
        getSounds: vi.fn((cb: (s: SoundData[]) => void) => cb(sounds)),
      }),
    )
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    const pending = wrapper.getSounds()
    await flushInit()
    await expect(pending).resolves.toEqual(sounds)
  })

  it('getSounds() queued before init resolves after replay', async () => {
    const sounds: SoundData[] = [{ id: 9, title: 'Nine', duration: 9000 }]
    installSdk(() =>
      makeFakeWidget({
        getSounds: vi.fn((cb: (s: SoundData[]) => void) => cb(sounds)),
      }),
    )
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    const pending = wrapper.getSounds()
    await flushInit()
    await expect(pending).resolves.toEqual(sounds)
  })

  it('suppresses SDK exceptions from delegated calls (safeCall)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    installSdk(() =>
      makeFakeWidget({
        play: vi.fn(() => {
          throw new Error('postMessage failed')
        }),
      }),
    )
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    await flushInit()
    expect(() => wrapper.play()).not.toThrow()
    expect(warn).toHaveBeenCalledWith(
      '[SoundCloudWidgetWrapper] suppressed:',
      expect.any(Error),
    )
  })

  it('a getSounds() whose SDK call throws never rejects (safeCall swallow)', async () => {
    installSdk(() =>
      makeFakeWidget({
        getSounds: vi.fn(() => {
          throw new Error('dead iframe')
        }),
      }),
    )
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    await flushInit()
    const pending = wrapper.getSounds()
    const settleMarker = vi
      .advanceTimersByTimeAsync(20)
      .then(() => 'still-pending')
    const raced = await Promise.race([
      pending.then(() => 'resolved'),
      settleMarker,
    ])
    expect(raced).toBe('still-pending')
  })
})

// ── waitForScDocument readiness paths ────────────────────────────────────────

describe('waitForScDocument readiness polling', () => {
  it('settles on a postMessage from the SC origin', async () => {
    const iframe = makeSameOriginIframe()
    new SoundCloudWidgetWrapper(iframe)
    // Same-origin contentDocument: not ready yet
    await flushInit(300)
    expect(widgetCtor).not.toHaveBeenCalled()
    window.dispatchEvent(
      new MessageEvent('message', { origin: SC_WIDGET_ORIGIN }),
    )
    await flushInit(150)
    expect(widgetCtor).toHaveBeenCalledTimes(1)
  })

  it('settles on the iframe load event', async () => {
    const iframe = makeSameOriginIframe()
    new SoundCloudWidgetWrapper(iframe)
    await flushInit(300)
    expect(widgetCtor).not.toHaveBeenCalled()
    iframe.dispatchEvent(new Event('load'))
    await flushInit(150)
    expect(widgetCtor).toHaveBeenCalledTimes(1)
  })

  it('ignores postMessages from other origins', async () => {
    const iframe = makeSameOriginIframe()
    new SoundCloudWidgetWrapper(iframe)
    await flushInit(300)
    window.dispatchEvent(
      new MessageEvent('message', { origin: 'https://evil.example' }),
    )
    await flushInit(300)
    expect(widgetCtor).not.toHaveBeenCalled()
    // Only the hard timeout settles it — fail-open
    await flushInit(8000)
    expect(widgetCtor).toHaveBeenCalledTimes(1)
  })

  it('fails open after the 8s hard timeout when nothing signals readiness', async () => {
    const iframe = makeSameOriginIframe()
    new SoundCloudWidgetWrapper(iframe)
    await flushInit(7900)
    expect(widgetCtor).not.toHaveBeenCalled()
    await flushInit(300)
    expect(widgetCtor).toHaveBeenCalledTimes(1)
  })

  it('constructs the widget exactly once despite repeated signals', async () => {
    const iframe = makeSameOriginIframe()
    new SoundCloudWidgetWrapper(iframe)
    window.dispatchEvent(
      new MessageEvent('message', { origin: SC_WIDGET_ORIGIN }),
    )
    iframe.dispatchEvent(new Event('load'))
    await flushInit(200)
    // Re-fire after settle — must not re-construct or double-resolve
    window.dispatchEvent(
      new MessageEvent('message', { origin: SC_WIDGET_ORIGIN }),
    )
    await flushInit(8200)
    expect(widgetCtor).toHaveBeenCalledTimes(1)
  })

  it('treats a SecurityError from contentDocument as cross-origin readiness', async () => {
    // Real browsers throw a SecurityError once the iframe navigates to SC;
    // jsdom cannot reproduce that, so the getter throws on later reads only.
    const iframe = makeSameOriginIframe()
    let reads = 0
    Object.defineProperty(iframe, 'contentDocument', {
      configurable: true,
      get: () => {
        if (reads++ > 0) throw new Error('SecurityError: cross-origin')
        return document.implementation.createHTMLDocument()
      },
    })
    new SoundCloudWidgetWrapper(iframe)
    // Immediate check saw same-origin; the first poll tick throws → ready
    await flushInit(150)
    expect(widgetCtor).not.toHaveBeenCalled()
    await flushInit(150)
    expect(widgetCtor).toHaveBeenCalledTimes(1)
  })

  it('dispose during the SC document wait prevents SDK construction', async () => {
    const iframe = makeSameOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    // Let init register the wait's listeners (and pass its first disposed
    // check) before disposing — this is the real mid-wait teardown race
    await vi.advanceTimersByTimeAsync(0)
    wrapper.dispose()
    iframe.dispatchEvent(new Event('load')) // settle the pending wait
    await flushInit(300)
    expect(widgetCtor).not.toHaveBeenCalled()
  })
})

// ── dispose ──────────────────────────────────────────────────────────────────

describe('SoundCloudWidgetWrapper dispose', () => {
  it('unbinds all six SDK events and nulls the widget', async () => {
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    await flushInit()
    const widget = widgetInstances[0]
    wrapper.dispose()
    expect(widget.unbind).toHaveBeenCalledTimes(6)
    for (const name of Object.values(SDK_EVENTS)) {
      expect(widget.unbind).toHaveBeenCalledWith(name)
    }
    // off() after dispose must not touch the (nulled) widget again
    widget.unbind.mockClear()
    wrapper.off('play')
    expect(widget.unbind).not.toHaveBeenCalled()
  })

  it('unbind failures are isolated — every event still gets attempted', async () => {
    installSdk(() =>
      makeFakeWidget({
        unbind: vi.fn((event: string) => {
          if (event === 'PLAY') throw new Error('gone')
        }),
      }),
    )
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    await flushInit()
    expect(() => wrapper.dispose()).not.toThrow()
    expect(widgetInstances[0].unbind).toHaveBeenCalledTimes(6)
  })

  it('dispose with no SDK global installed does not throw', async () => {
    const iframe = makeCrossOriginIframe()
    const wrapper = new SoundCloudWidgetWrapper(iframe)
    await flushInit()
    delete window.SC
    expect(() => wrapper.dispose()).not.toThrow()
  })
})

// ── SDK script injection (fresh module copies — sdkPromise is module state) ──

describe('SDK script injection', () => {
  async function importFreshWidget() {
    vi.resetModules()
    return import('~/lib/sources/soundcloud/widget')
  }

  it('injects the api.js script once and resolves on load', async () => {
    delete window.SC
    const mod = await importFreshWidget()
    const iframe = makeCrossOriginIframe()
    new mod.SoundCloudWidgetWrapper(iframe)
    await flushInit(200)
    const script = document.head.querySelector<HTMLScriptElement>(
      `script[src="${SDK_SRC}"]`,
    )
    expect(script).not.toBeNull()
    expect(script?.async).toBe(true)
    // No widget yet — SDK not loaded
    expect(widgetCtor).not.toHaveBeenCalled()
    installSdk()
    script?.dispatchEvent(new Event('load'))
    await flushInit(200)
    expect(widgetCtor).toHaveBeenCalledTimes(1)
    expect(widgetCtor).toHaveBeenCalledWith(iframe)
  })

  it('reuses one pending sdkPromise for concurrent wrappers', async () => {
    delete window.SC
    const mod = await importFreshWidget()
    const iframeA = makeCrossOriginIframe()
    const iframeB = makeCrossOriginIframe()
    new mod.SoundCloudWidgetWrapper(iframeA)
    new mod.SoundCloudWidgetWrapper(iframeB)
    await flushInit(200)
    const scripts = document.head.querySelectorAll(`script[src="${SDK_SRC}"]`)
    expect(scripts).toHaveLength(1)
    installSdk()
    scripts[0].dispatchEvent(new Event('load'))
    await flushInit(200)
    expect(widgetCtor).toHaveBeenCalledTimes(2)
    expect(widgetCtor).toHaveBeenNthCalledWith(1, iframeA)
    expect(widgetCtor).toHaveBeenNthCalledWith(2, iframeB)
  })

  it('rejects when the script loads but window.SC.Widget never appears', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    delete window.SC
    const mod = await importFreshWidget()
    const iframe = makeCrossOriginIframe()
    new mod.SoundCloudWidgetWrapper(iframe)
    await flushInit(200)
    const script = document.head.querySelector<HTMLScriptElement>(
      `script[src="${SDK_SRC}"]`,
    )
    expect(script).not.toBeNull()
    // onload fires with window.SC still missing
    script?.dispatchEvent(new Event('load'))
    await flushInit(300)
    expect(widgetCtor).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      '[SoundCloudWidgetWrapper] SDK init failed:',
      expect.objectContaining({
        message: 'SC SDK loaded but window.SC.Widget missing',
      }),
    )
  })

  it('rejects on script network error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    delete window.SC
    const mod = await importFreshWidget()
    const iframe = makeCrossOriginIframe()
    new mod.SoundCloudWidgetWrapper(iframe)
    await flushInit(200)
    const script = document.head.querySelector<HTMLScriptElement>(
      `script[src="${SDK_SRC}"]`,
    )
    script?.dispatchEvent(new Event('error'))
    await flushInit(300)
    expect(widgetCtor).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      '[SoundCloudWidgetWrapper] SDK init failed:',
      expect.objectContaining({ message: 'Failed to load SC SDK' }),
    )
  })

  it('prefers an already-present window.SC.Widget over injecting a script', async () => {
    const mod = await importFreshWidget()
    const iframe = makeCrossOriginIframe()
    new mod.SoundCloudWidgetWrapper(iframe)
    await flushInit(200)
    expect(widgetCtor).toHaveBeenCalledTimes(1)
    expect(document.head.querySelector(`script[src="${SDK_SRC}"]`)).toBeNull()
  })
})
