import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import React from 'react'
import {
  ScWidgetProvider,
  useScWidget,
} from '~/lib/sources/soundcloud/sc-widget-context'
import type { useScWidget as UseScWidget } from '~/lib/sources/soundcloud/sc-widget-context'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import type { MusicChannel, Track } from '~/lib/scheduling/types'

// ── Mocks (hoisted so the mocked module can reference them) ──────────────────

const { FakeWidgetWrapper, rumMocks } = vi.hoisted(() => {
  class FakeWidgetWrapperImpl {
    static instances: FakeWidgetWrapperImpl[] = []
    readonly listeners = new Map<string, Set<(data?: unknown) => void>>()
    readonly loadCalls: Array<{
      url: string
      options: Record<string, unknown>
    }> = []
    readonly seekToCalls: number[] = []
    readonly volumeCalls: number[] = []
    playCount = 0
    pauseCount = 0
    disposed = false

    constructor(readonly el: HTMLIFrameElement) {
      FakeWidgetWrapperImpl.instances.push(this)
    }

    on(event: string, cb: (data?: unknown) => void): void {
      const set = this.listeners.get(event) ?? new Set()
      set.add(cb)
      this.listeners.set(event, set)
    }

    off(event: string): void {
      this.listeners.delete(event)
    }

    load(
      url: string,
      options: Record<string, unknown>,
      _onLoaded?: () => void,
    ): void {
      this.loadCalls.push({ url, options })
    }

    play(): void {
      this.playCount++
    }

    pause(): void {
      this.pauseCount++
    }

    seekTo(positionMs: number): void {
      this.seekToCalls.push(positionMs)
    }

    setVolume(volume: number): void {
      this.volumeCalls.push(volume)
    }

    dispose(): void {
      this.disposed = true
    }

    /** Fire a widget event exactly the way the real SDK dispatcher would. */
    emit(event: string, data?: unknown): void {
      for (const cb of this.listeners.get(event) ?? []) cb(data)
    }
  }

  return {
    FakeWidgetWrapper: FakeWidgetWrapperImpl,
    rumMocks: {
      trackScRealign: vi.fn(),
      trackScTrackUnplayable: vi.fn(),
      trackScEarlyFinish: vi.fn(),
      urlCorrelationId: vi.fn((url: string) => `cid:${url}`),
    },
  }
})

vi.mock('~/lib/sources/soundcloud/widget', () => ({
  SoundCloudWidgetWrapper: FakeWidgetWrapper,
  buildWidgetSrc: (playlistUrl: string) =>
    `https://w.soundcloud.com/player/?url=${encodeURIComponent(playlistUrl)}`,
}))

vi.mock('~/lib/datadog/rum', () => rumMocks)

// ── Deterministic scheduler fixtures ──────────────────────────────────────────
//
// Two 120s tracks. The scheduler's rotation seed also has an hourly component
// (getHoursSinceEpoch), so every timeline below stays inside one wall-clock
// hour (anchored at 12:10Z) to keep positions a pure walk of the timeline.
// T0 is 10s into FIRST's slot; that slot ends at T0 + 110s.

const TRACK_A: Track = {
  id: 'alpha',
  title: 'Alpha',
  artist: 'Artist A',
  durationSeconds: 120,
  embedUrl: 'https://w.soundcloud.com/player/?url=alpha',
}

const TRACK_B: Track = {
  id: 'bravo',
  title: 'Bravo',
  artist: 'Artist B',
  durationSeconds: 120,
  embedUrl: 'https://w.soundcloud.com/player/?url=bravo',
}

const CHANNEL: MusicChannel = {
  kind: 'music',
  id: 'sc-test',
  number: 50,
  name: 'SC Test',
  source: 'soundcloud',
  sourceUrl: 'https://soundcloud.com/artist-a/sets/test-set',
  totalDurationSeconds: 240,
  trackCount: 2,
  tracks: [TRACK_A, TRACK_B],
}

const ANCHOR = new Date('2025-06-01T12:10:00Z')
const ANCHOR_POS = getSchedulePosition(CHANNEL, ANCHOR)
const FIRST = ANCHOR_POS.item as Track
const SECOND = FIRST.id === TRACK_A.id ? TRACK_B : TRACK_A
const T0 = new Date(ANCHOR_POS.slotStartTime.getTime() + 10_000)
const FIRST_SLOT_END_MS = ANCHOR_POS.slotEndTime.getTime()

type ScApi = ReturnType<typeof UseScWidget>
type FakeWidget = InstanceType<typeof FakeWidgetWrapper>

let api: ScApi | null = null
function Probe(): React.ReactNode {
  api = useScWidget()
  return null
}

let userActivationActive = false

function widget(): FakeWidget {
  return FakeWidgetWrapper.instances[0]
}

function providerIframe(): HTMLIFrameElement {
  return screen.getByTitle<HTMLIFrameElement>('SoundCloud Player')
}

/** Advance fake time, flushing microtasks inside act (effects may setState). */
async function tick(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** Fire a widget event inside act — handlers may setState or schedule loads. */
function fire(event: string, data?: unknown): void {
  act(() => {
    widget().emit(event, data)
  })
}

function renderProvider(
  props: { isMuted?: boolean; volume?: number } = {},
): ReturnType<typeof render> {
  return render(
    <ScWidgetProvider {...props}>
      <Probe />
    </ScWidgetProvider>,
  )
}

function activate(ch: MusicChannel | null = CHANNEL): void {
  act(() => {
    api?.setActiveChannel(ch)
  })
}

/** Confirm the in-flight load with a non-stale progress event, then play. */
async function confirmAndPlay(progressMs = 1_000): Promise<void> {
  await tick(progressMs)
  fire('playProgress', { currentPosition: 10_000 })
  fire('play')
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  FakeWidgetWrapper.instances.length = 0
  rumMocks.trackScRealign.mockClear()
  rumMocks.trackScTrackUnplayable.mockClear()
  rumMocks.trackScEarlyFinish.mockClear()
  rumMocks.urlCorrelationId.mockClear()
  userActivationActive = false
  Object.defineProperty(navigator, 'userActivation', {
    configurable: true,
    get: () => ({ isActive: userActivationActive }),
  })
  // jsdom reports hidden=true by default; the provider's visibility listener
  // must see a visible document to run its immediate reconcile pass
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => false,
  })
})

afterEach(() => {
  vi.useRealTimers()
  window.history.pushState({}, '', '/')
})

// ── Mount + context ─────────────────────────────────────────────────────────

describe('ScWidgetProvider mount', () => {
  it('constructs exactly one persistent wrapper on a hidden off-screen iframe', () => {
    renderProvider()
    expect(FakeWidgetWrapper.instances).toHaveLength(1)
    const el = providerIframe()
    expect(el).toBeInstanceOf(HTMLIFrameElement)
    // Off-screen but full opacity (Chrome throttles opacity:0 iframes)
    expect(el.style.transform).toBe('translate(150%, 150%)')
    expect(el.style.opacity).toBe('1')
    expect(el.getAttribute('aria-hidden')).toBe('true')
    // Bootstrapped with the stable SC track so the SDK has a real document
    expect(el.src).toContain(
      encodeURIComponent('https://api.soundcloud.com/tracks/293'),
    )
    expect(el.src).toContain('auto_play=false')
  })

  it('exposes the wrapper through context with mounting status and no channel', () => {
    renderProvider()
    expect(api?.widget).toBe(widget())
    expect(api?.status).toBe('mounting')
    expect(api?.isReady).toBe(false)
    expect(api?.activeChannelId).toBe(null)
  })

  it('READY flips status to ready and isReady to true', () => {
    renderProvider()
    fire('ready')
    expect(api?.status).toBe('ready')
    expect(api?.isReady).toBe(true)
  })

  it('a 6s failsafe arms isReady even if READY never fires', async () => {
    renderProvider()
    await tick(5_999)
    expect(api?.isReady).toBe(false)
    await tick(2)
    expect(api?.isReady).toBe(true)
    expect(api?.status).toBe('mounting')
  })

  it('play/pause events map to playing/paused status', () => {
    renderProvider()
    fire('ready')
    fire('play')
    expect(api?.status).toBe('playing')
    fire('pause')
    expect(api?.status).toBe('paused')
  })

  it('an error event with no active channel only sets error status', () => {
    renderProvider()
    fire('error')
    expect(api?.status).toBe('error')
    expect(rumMocks.trackScTrackUnplayable).not.toHaveBeenCalled()
    expect(widget().loadCalls).toHaveLength(0)
  })

  it('a playProgress event with no pending load is ignored without crashing', () => {
    renderProvider()
    expect(() => fire('playProgress', { currentPosition: 5_000 })).not.toThrow()
    expect(widget().seekToCalls).toHaveLength(0)
  })

  it('enlarges the iframe when mounted under ?debug-sc', () => {
    window.history.pushState({}, '', '/?debug-sc')
    renderProvider()
    const el = providerIframe()
    expect(el.style.width).toBe('480px')
    expect(el.style.height).toBe('160px')
    expect(el.style.pointerEvents).toBe('auto')
    expect(el.getAttribute('aria-hidden')).toBe('false')
  })
})

// ── setActiveChannel: loading the live-scheduled track ───────────────────────

describe('ScWidgetProvider setActiveChannel', () => {
  it('loads the currently-scheduled track muted, then seeks on first progress', async () => {
    renderProvider()
    fire('ready')
    activate()

    expect(api?.activeChannelId).toBe(CHANNEL.id)
    expect(api?.status).toBe('mounting')
    const w = widget()
    expect(w.loadCalls).toHaveLength(1)
    expect(w.loadCalls[0]).toEqual({
      url: FIRST.embedUrl,
      options: { auto_play: true },
    })
    // Mute-before-load: volume zeroed while awaiting PLAY_PROGRESS, then the
    // volume effect (activeChannelId just committed, unmuted) restores 80
    expect(w.volumeCalls).toEqual([0, 80])

    // First non-stale progress confirms the URL and triggers the seek
    await tick(1_000)
    fire('playProgress', { currentPosition: 10_000 })
    expect(w.seekToCalls).toEqual([10_000])
    // No prior user activation → no extra volume restore, no autoplay
    expect(w.volumeCalls).toEqual([0, 80])
    expect(w.playCount).toBe(0)
  })

  it('restores volume and plays after the seek when the user has activated the page', async () => {
    userActivationActive = true
    renderProvider({ volume: 55 })
    activate()
    await tick(1_000)
    fire('playProgress', { currentPosition: 10_000 })
    const w = widget()
    expect(w.volumeCalls).toEqual([0, 55, 55]) // mute, effect restore, doSeek restore
    expect(w.playCount).toBe(1)
  })

  it('progress inside the stale window seeks but does not confirm; the loop later retries via load-timeout', async () => {
    renderProvider()
    activate()
    // Progress at Date.now()-startedAtMs === 0 < 750ms → stale: the pending
    // seek still fires...
    fire('playProgress', { currentPosition: 10_000 })
    expect(widget().seekToCalls).toEqual([10_000])
    fire('play')
    // ...but the URL was never confirmed, so once the 10s load grace lapses
    // the reconcile loop reloads the scheduled track
    await tick(11_000)
    const w = widget()
    expect(w.loadCalls).toHaveLength(2)
    expect(w.loadCalls[1].url).toBe(FIRST.embedUrl)
    expect(rumMocks.trackScRealign).toHaveBeenCalledWith(
      'load-timeout',
      0,
      CHANNEL.id,
      expect.any(String),
    )
  })

  it('the 3s seek fallback seeks without any progress event', async () => {
    userActivationActive = true
    renderProvider()
    activate()
    await tick(3_000)
    const w = widget()
    expect(w.seekToCalls).toEqual([10_000])
    expect(w.playCount).toBe(1)
    // The fallback consumed the pending seek: a later progress must not re-seek
    fire('playProgress', { currentPosition: 99 })
    expect(w.seekToCalls).toHaveLength(1)
  })

  it('is idempotent for the same channel at the same scheduled position', async () => {
    renderProvider()
    activate()
    activate()
    await tick(500)
    activate()
    expect(widget().loadCalls).toHaveLength(1)
  })

  it('loads a different channel on switch', () => {
    const other: MusicChannel = {
      ...CHANNEL,
      id: 'sc-other',
      tracks: [
        { ...TRACK_A, embedUrl: 'https://w.soundcloud.com/player/?url=x' },
        { ...TRACK_B, embedUrl: 'https://w.soundcloud.com/player/?url=y' },
      ],
    }
    const otherFirst = getSchedulePosition(other, T0).item as Track
    renderProvider()
    activate()
    activate(other)
    expect(widget().loadCalls).toHaveLength(2)
    expect(widget().loadCalls[1].url).toBe(otherFirst.embedUrl)
  })

  it('activating a channel with no tracks sets the id but loads nothing', async () => {
    renderProvider()
    activate({ ...CHANNEL, tracks: undefined })
    expect(api?.activeChannelId).toBe(CHANNEL.id)
    expect(widget().loadCalls).toHaveLength(0)
    // The reconcile loop is wired but inert without tracks
    await tick(3_000)
    expect(widget().loadCalls).toHaveLength(0)
    expect(rumMocks.trackScRealign).not.toHaveBeenCalled()
  })

  it('a muted channel seeks on progress but never auto-plays', async () => {
    renderProvider({ isMuted: true })
    activate()
    await tick(1_000)
    // Progress without a payload: position falls back to 0
    fire('playProgress')
    const w = widget()
    expect(w.seekToCalls).toEqual([10_000])
    expect(w.playCount).toBe(0)
    // Only the mute zeroes — no unmuted restore ever fires
    expect(w.volumeCalls.every((v) => v === 0)).toBe(true)
  })

  it('null pauses the widget, resets truth, and cancels pending seeks', async () => {
    renderProvider()
    activate()
    const pauseBefore = widget().pauseCount
    activate(null)
    expect(api?.activeChannelId).toBe(null)
    expect(widget().pauseCount).toBe(pauseBefore + 1)
    // The load's 3s seek fallback was cancelled — no seek may fire late
    await tick(5_000)
    expect(widget().seekToCalls).toHaveLength(0)
    // Widget events after teardown are inert
    expect(() => fire('finish')).not.toThrow()
    expect(widget().loadCalls).toHaveLength(1)
  })
})

// ── Finish → advance ─────────────────────────────────────────────────────────

describe('ScWidgetProvider finish handling', () => {
  it('a natural finish while still scheduled advances to the next slot and reports the early finish', async () => {
    renderProvider()
    activate()
    await confirmAndPlay(2_000)

    // Still inside FIRST's slot → the stream ended early
    expect(Date.now()).toBeLessThan(FIRST_SLOT_END_MS)
    fire('finish')

    const w = widget()
    expect(w.loadCalls).toHaveLength(2)
    expect(w.loadCalls[1].url).toBe(SECOND.embedUrl)
    expect(rumMocks.trackScEarlyFinish).toHaveBeenCalledTimes(1)
    expect(rumMocks.trackScEarlyFinish).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: CHANNEL.id,
        trackId: FIRST.id,
        reason: 'finish',
      }),
    )
  })

  it('a second finish within the 1.5s rapid-loop window is blocked', async () => {
    renderProvider()
    activate()
    await confirmAndPlay(2_000)
    fire('finish')
    expect(widget().loadCalls).toHaveLength(2)
    fire('finish')
    expect(widget().loadCalls).toHaveLength(2)
  })

  it('a finish before any progress still advances with a full-slot shortfall', async () => {
    renderProvider()
    activate()
    await tick(2_000)
    fire('finish')
    expect(widget().loadCalls).toHaveLength(2)
    expect(rumMocks.trackScEarlyFinish).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: CHANNEL.id,
        trackId: FIRST.id,
        reason: 'finish',
        shortfallSeconds: 120, // no progress ever recorded → full slot missed
      }),
    )
  })

  it('a late finish for the URL still being loaded does not burn its retry budget', async () => {
    // Single-track channel: every natural finish legitimately replays the
    // same URL, so the in-flight guard is what prevents a double-load.
    const single: MusicChannel = {
      ...CHANNEL,
      id: 'sc-single',
      totalDurationSeconds: 120,
      trackCount: 1,
      tracks: [FIRST],
    }
    renderProvider()
    activate(single)
    await tick(2_000)
    fire('finish')
    const w = widget()
    // The same-URL load is still in flight (no progress confirmed it)
    expect(w.loadCalls).toHaveLength(1)
    await tick(2_000)
    expect(w.loadCalls).toHaveLength(1)
  })

  it('reconcile stays dormant on the exhausted track until the slot moves on', async () => {
    renderProvider()
    activate()
    await confirmAndPlay(2_000)
    fire('finish') // FIRST exhausted early, SECOND loaded for the next slot
    expect(widget().loadCalls).toHaveLength(2)
    expect(rumMocks.trackScRealign).not.toHaveBeenCalled()

    // Confirm SECOND's load so the loop has real widget truth for it
    await tick(1_000)
    fire('playProgress', { currentPosition: 1_000 })
    fire('play')

    // While FIRST is still the scheduled track, reconcile must not reload
    // its unplayable remainder (exhausted dormancy)
    await tick(10_000)
    expect(widget().loadCalls).toHaveLength(2)

    // Past the slot boundary the schedule hands over to SECOND; the
    // exhausted marker clears and the loop resumes normal operation —
    // no reloads, no realign spam
    await tick(FIRST_SLOT_END_MS - Date.now() + 1_000)
    expect(widget().loadCalls).toHaveLength(2)
    expect(rumMocks.trackScRealign).not.toHaveBeenCalled()
  })

  it('re-activating the channel while its scheduled track is exhausted does not reload it', async () => {
    renderProvider()
    activate()
    await confirmAndPlay(2_000)
    fire('finish') // FIRST exhausted, SECOND loaded for the next slot
    expect(widget().loadCalls).toHaveLength(2)

    // Same channel, still inside FIRST's (exhausted) scheduled slot: the
    // idempotent path does not apply (a different URL is loaded), so the
    // exhausted guard is what prevents a reload of the dead remainder
    activate()
    expect(widget().loadCalls).toHaveLength(2)
  })
})

// ── Error → advance ──────────────────────────────────────────────────────────

describe('ScWidgetProvider error handling', () => {
  it('an error advances past the dead track with unplayable telemetry', async () => {
    renderProvider()
    activate()
    await confirmAndPlay(2_000)

    fire('error')
    // The transient 'error' status is immediately superseded by the advance
    // load of the next track
    expect(api?.status).toBe('mounting')
    const w = widget()
    expect(w.loadCalls).toHaveLength(2)
    expect(w.loadCalls[1].url).toBe(SECOND.embedUrl)
    expect(rumMocks.trackScTrackUnplayable).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: CHANNEL.id,
        trackId: FIRST.id,
        reason: 'widget-error',
      }),
    )
    expect(rumMocks.trackScEarlyFinish).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: CHANNEL.id,
        trackId: FIRST.id,
        reason: 'widget-error',
      }),
    )
  })

  it('an all-dead channel stops cycling once every track is reported', async () => {
    renderProvider()
    activate()
    await confirmAndPlay(2_000)

    fire('error') // FIRST dead → advance to SECOND (attempts 1)
    fire('error') // within 1.5s of the advance → blocked
    expect(widget().loadCalls).toHaveLength(2)

    // Confirm SECOND so its error can be evaluated on its own merits
    await tick(1_000)
    fire('playProgress', { currentPosition: 1_000 })
    await tick(1_000)
    fire('error') // SECOND dead too → reported (attempts 2)
    expect(widget().loadCalls).toHaveLength(2)
    expect(rumMocks.trackScTrackUnplayable).toHaveBeenCalledTimes(2)
    expect(rumMocks.trackScTrackUnplayable).toHaveBeenLastCalledWith(
      expect.objectContaining({
        channelId: CHANNEL.id,
        trackId: SECOND.id,
        reason: 'widget-error',
      }),
    )

    // Budget spent: further errors cannot restart the cycle, so this one
    // leaves the error status in place
    await tick(2_000)
    fire('error')
    expect(api?.status).toBe('error')
    expect(widget().loadCalls).toHaveLength(2)
    expect(rumMocks.trackScTrackUnplayable).toHaveBeenCalledTimes(2)
  })
})

// ── Reconcile loop ───────────────────────────────────────────────────────────

describe('ScWidgetProvider reconcile loop', () => {
  it('corrects in-track drift with a seek once past the settle window (interval trigger)', async () => {
    renderProvider()
    activate()
    await confirmAndPlay(1_000) // seek stamped at T0+1000

    // Widget truth frozen at 10s while the wall clock walks on. Drift exceeds
    // the 12s tolerance from T0+13s; the first interval tick past both the
    // tolerance and the 5s settle window lands at T0+13s.
    await tick(12_000)
    const w = widget()
    expect(w.seekToCalls).toEqual([10_000, 23_000])
    expect(rumMocks.trackScRealign).toHaveBeenCalledTimes(1)
    expect(rumMocks.trackScRealign).toHaveBeenCalledWith(
      'drift',
      13,
      CHANNEL.id,
      'interval',
    )
  })

  it('runs an immediate reconcile pass on visibility regain (visibility trigger)', async () => {
    renderProvider()
    activate()
    await tick(1_300)
    // Progress at position 0: drift is already past tolerance, so the seek
    // is held back only by the 5s settle window that opened at T0+1300
    fire('playProgress', { currentPosition: 0 })
    fire('play')

    // Advance to T0+6.5s — between interval ticks. Every tick so far was a
    // noop: drift 12s at T0+2s misses tolerance, and later ticks are inside
    // the settle window.
    await tick(5_200)
    expect(widget().seekToCalls).toEqual([10_000])

    // Hidden tabs get no immediate pass
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(widget().seekToCalls).toEqual([10_000])

    // Tab regains visibility between ticks → immediate correction
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(widget().seekToCalls).toEqual([10_000, 16_000])
    expect(rumMocks.trackScRealign).toHaveBeenCalledWith(
      'drift',
      16,
      CHANNEL.id,
      'visibility',
    )
  })

  it('reloads on track mismatch once the schedule crosses the slot boundary', async () => {
    renderProvider()
    activate()
    await confirmAndPlay(1_000)

    // Cross into SECOND's slot with FIRST still confirmed
    await tick(FIRST_SLOT_END_MS - Date.now() + 100)
    const w = widget()
    expect(w.loadCalls).toHaveLength(2)
    expect(w.loadCalls[1].url).toBe(SECOND.embedUrl)
    expect(rumMocks.trackScRealign).toHaveBeenCalledWith(
      'track-mismatch',
      0,
      CHANNEL.id,
      expect.any(String),
    )
  })

  it('never corrects a widget that is not playing', async () => {
    renderProvider()
    activate()
    await tick(1_000)
    fire('playProgress', { currentPosition: 10_000 })
    // Deliberately no fire('play') → status stays 'mounting'
    await tick(FIRST_SLOT_END_MS - Date.now() + 5_000)
    expect(widget().loadCalls).toHaveLength(1)
    expect(rumMocks.trackScRealign).not.toHaveBeenCalled()
  })

  it('gives up on a dead track after same-URL retries are exhausted (one report)', async () => {
    renderProvider()
    activate()
    // Never any progress → every load times out after its 10s grace.
    // Ticks are 1000-aligned; the first tick past grace is T0+11s, the
    // retry's is T0+22s, and the third grace lapse reports exhaustion.
    await tick(33_000)
    const w = widget()
    // Initial load + two same-URL retries, then the loop stops hammering
    expect(w.loadCalls).toHaveLength(3)
    expect(w.loadCalls.map((c) => c.url)).toEqual([
      FIRST.embedUrl,
      FIRST.embedUrl,
      FIRST.embedUrl,
    ])
    expect(rumMocks.trackScTrackUnplayable).toHaveBeenCalledTimes(1)
    expect(rumMocks.trackScTrackUnplayable).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: CHANNEL.id,
        trackId: FIRST.id,
        reason: 'load-retries-exhausted',
        retryCount: 2,
      }),
    )
    // One-shot: further ticks do not re-report
    await tick(3_000)
    expect(rumMocks.trackScTrackUnplayable).toHaveBeenCalledTimes(1)
    expect(w.loadCalls).toHaveLength(3)
  })
})

// ── Mute / volume ────────────────────────────────────────────────────────────

describe('ScWidgetProvider mute and volume', () => {
  it('mutes and pauses on isMuted, restores volume on unmute, and never calls play itself', async () => {
    userActivationActive = true
    const view = renderProvider({ volume: 55 })
    activate()
    await tick(1_000)
    fire('playProgress', { currentPosition: 10_000 })
    fire('play')
    const w = widget()
    expect(w.volumeCalls).toEqual([0, 55, 55]) // mute, effect restore, doSeek restore

    view.rerender(
      <ScWidgetProvider volume={55} isMuted>
        <Probe />
      </ScWidgetProvider>,
    )
    expect(w.volumeCalls[w.volumeCalls.length - 1]).toBe(0)
    expect(w.pauseCount).toBeGreaterThan(0)

    const playsBeforeUnmute = w.playCount
    view.rerender(
      <ScWidgetProvider volume={55}>
        <Probe />
      </ScWidgetProvider>,
    )
    expect(w.volumeCalls[w.volumeCalls.length - 1]).toBe(55)
    // play() is exclusively owned by the doSeek path
    expect(w.playCount).toBe(playsBeforeUnmute)
  })
})

// ── Cleanup ─────────────────────────────────────────────────────────────────

describe('ScWidgetProvider cleanup', () => {
  it('unmount pauses and disposes the widget and tears down the reconcile loop', async () => {
    const view = renderProvider()
    activate()
    await confirmAndPlay(1_000)
    const w = widget()
    const pausesBeforeUnmount = w.pauseCount

    view.unmount()
    expect(w.disposed).toBe(true)
    expect(w.pauseCount).toBe(pausesBeforeUnmount + 1)

    // No leaked loop work after teardown
    const realignBefore = rumMocks.trackScRealign.mock.calls.length
    await tick(20_000)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(rumMocks.trackScRealign.mock.calls.length).toBe(realignBefore)
    expect(w.loadCalls).toHaveLength(1)
  })
})

describe('useScWidget guard', () => {
  it('throws when used outside ScWidgetProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(
      'useScWidget must be used within ScWidgetProvider',
    )
    consoleError.mockRestore()
  })
})
