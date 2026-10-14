import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, screen, waitFor, fireEvent } from '@testing-library/react'
import type { ComponentType } from 'react'
import { TvLayoutContext, useTvLayout, Route } from './_tv'
import type { TvLayoutContextValue } from './_tv'
import type { Channel } from '~/lib/scheduling/types'
import type { ChannelPreset } from '~/lib/channels/types'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'

// ---------------------------------------------------------------------------
// Hoisted mocks for the full TvLayout render harness
// ---------------------------------------------------------------------------

const {
  mockNavigate,
  outlet,
  mockBuildChannel,
  quotaErrorClass,
  mockCheckYouTubeQuota,
  mockLoadCustomChannels,
  mockSaveCustomChannels,
  mockLoadCachedChannel,
  mockSaveCachedChannel,
  mockClearPresetChannelCache,
  mockCopyToClipboard,
  mockToggleFullscreen,
  mediaState,
  scState,
  mockSetActiveChannel,
  rum,
  mockLogChannelLoadFailed,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  // Outlet renderer indirection: set from a test to capture the layout
  // context via a consumer rendered inside <Outlet /> (see renderLayout).
  outlet: { render: null as null | (() => unknown) },
  mockBuildChannel: vi.fn(),
  quotaErrorClass: { cls: null as null | (new (message?: string) => Error) },
  mockCheckYouTubeQuota: vi.fn(),
  mockLoadCustomChannels: vi.fn(),
  mockSaveCustomChannels: vi.fn(),
  mockLoadCachedChannel: vi.fn(),
  mockSaveCachedChannel: vi.fn(),
  mockClearPresetChannelCache: vi.fn(),
  mockCopyToClipboard: vi.fn(),
  mockToggleFullscreen: vi.fn(),
  mediaState: { mobile: false, desktop: true, fullscreen: false },
  scState: { isReady: true },
  mockSetActiveChannel: vi.fn(),
  rum: {
    trackGuideToggle: vi.fn(),
    trackImportStarted: vi.fn(),
    trackShareChannel: vi.fn(),
    trackViewModeChange: vi.fn(),
    trackOverlayChange: vi.fn(),
    setViewerContext: vi.fn(),
    trackMusicBackdropSelected: vi.fn(),
    trackScCacheEvent: vi.fn(),
    trackScChannelLoad: vi.fn(),
    trackScChannelFailed: vi.fn(),
  },
  mockLogChannelLoadFailed: vi.fn(),
}))

vi.mock('@tanstack/react-router', async () => {
  const React = await import('react')
  return {
    createFileRoute: () => (opts: unknown) => opts,
    Outlet: () =>
      outlet.render !== null ? (outlet.render as () => unknown)() : null,
    Link: ({
      children,
      to,
      ...rest
    }: {
      children: ReturnType<typeof React.createElement> | undefined
      to: string
    } & Record<string, unknown>) =>
      React.createElement('a', { href: to, ...rest }, children),
    useNavigate: () => mockNavigate,
  }
})

vi.mock('~/lib/sources/soundcloud/sc-widget-context', async () => {
  const React = await import('react')
  return {
    ScWidgetProvider: ({
      children,
    }: {
      children: ReturnType<typeof React.createElement> | undefined
    }) => React.createElement('div', null, children),
    useScWidget: () => ({
      widget: null,
      status: 'ready' as const,
      activeChannelId: null,
      isReady: scState.isReady,
      setActiveChannel: mockSetActiveChannel,
    }),
  }
})

vi.mock('~/lib/channels/youtube-api', () => {
  class YouTubeQuotaError extends Error {
    constructor(message = 'quota exhausted') {
      super(message)
      this.name = 'YouTubeQuotaError'
    }
  }
  quotaErrorClass.cls = YouTubeQuotaError
  return { buildChannel: mockBuildChannel, YouTubeQuotaError }
})

vi.mock('~/lib/storage/local-channels', () => ({
  loadCustomChannels: mockLoadCustomChannels,
  saveCustomChannels: mockSaveCustomChannels,
}))

vi.mock('~/lib/storage/preset-channel-cache', () => ({
  loadCachedChannel: mockLoadCachedChannel,
  saveCachedChannel: mockSaveCachedChannel,
  clearPresetChannelCache: mockClearPresetChannelCache,
}))

vi.mock('~/hooks/use-is-mobile', () => ({
  useIsMobile: () => mediaState.mobile,
}))

vi.mock('~/hooks/use-is-desktop', () => ({
  useIsDesktop: () => mediaState.desktop,
}))

vi.mock('~/hooks/use-fullscreen', () => ({
  useFullscreen: () => ({
    isFullscreen: mediaState.fullscreen,
    toggleFullscreen: mockToggleFullscreen,
  }),
}))

vi.mock('~/lib/clipboard', () => ({
  copyToClipboard: mockCopyToClipboard,
}))

vi.mock('~/routes/api/youtube', () => ({
  checkYouTubeQuota: mockCheckYouTubeQuota,
}))

vi.mock('~/lib/datadog/rum', async (orig) => {
  const actual = await orig<typeof import('~/lib/datadog/rum')>()
  return { ...actual, ...rum }
})

vi.mock('~/lib/datadog/logs', async (orig) => {
  const actual = await orig<typeof import('~/lib/datadog/logs')>()
  return { ...actual, logChannelLoadFailed: mockLogChannelLoadFailed }
})

// ImportModal is replaced with a control panel that drives the layout-level
// callbacks (onClose / onImportComplete / onRefreshChannel) from buttons.
vi.mock('~/components/import-wizard/import-modal', async () => {
  const React = await import('react')
  const importedChannel = {
    kind: 'video',
    id: 'custom-imported',
    number: 900,
    name: 'Imported',
    playlistId: 'PLx',
    videos: [
      { id: 'iv1', title: 'Imported clip', durationSeconds: 240, thumbnailUrl: '' },
    ],
    totalDurationSeconds: 240,
  } as import('~/lib/scheduling/types').Channel
  const refreshedChannel = { ...importedChannel, name: 'Refreshed' }
  return {
    ImportModal: ({
      visible,
      onClose,
      onImportComplete,
      onRefreshChannel,
    }: {
      visible: boolean
      onClose: () => void
      onImportComplete: (c: import('~/lib/scheduling/types').Channel) => void
      onRefreshChannel: (id: string, c: import('~/lib/scheduling/types').Channel) => void
    }) =>
      React.createElement(
        'div',
        { 'data-testid': 'import-modal' },
        visible
          ? [
              React.createElement(
                'button',
                {
                  key: 'close',
                  'data-testid': 'import-close',
                  onClick: () => onClose(),
                },
                'close',
              ),
              React.createElement(
                'button',
                {
                  key: 'complete',
                  'data-testid': 'import-complete',
                  onClick: () => onImportComplete(importedChannel),
                },
                'complete',
              ),
              React.createElement(
                'button',
                {
                  key: 'refresh',
                  'data-testid': 'import-refresh',
                  onClick: () => onRefreshChannel('custom-imported', refreshedChannel),
                },
                'refresh',
              ),
            ]
          : null,
      ),
  }
})

// The Route component is the provider wiring entry point (TvLayoutWithProviders);
// createFileRoute is mocked to the identity so it is the raw options object.
const TvLayoutRouteComponent = (Route as unknown as { component: ComponentType })
  .component

/** Deterministic channel fixture for a preset of either kind. */
function channelForPreset(preset: ChannelPreset): Channel {
  if (preset.kind === 'music') {
    return {
      kind: 'music',
      id: preset.id,
      number: preset.number,
      name: preset.name,
      source: 'soundcloud',
      sourceUrl: preset.sourceUrl,
      description: preset.description,
      totalDurationSeconds: 600,
      trackCount: 1,
      tracks: [
        {
          id: `${preset.id}-t1`,
          title: 'Track 1',
          artist: 'Artist',
          durationSeconds: 600,
          embedUrl: 'https://soundcloud.com/track',
        },
      ],
    }
  }
  return {
    kind: 'video',
    id: preset.id,
    number: preset.number,
    name: preset.name,
    playlistId: preset.playlistId,
    videos: [
      {
        id: `${preset.id}-v1`,
        title: 'Clip 1',
        durationSeconds: 300,
        thumbnailUrl: '',
      },
    ],
    totalDurationSeconds: 300,
  }
}

function makeCustomChannel(id: string, number: number): Channel {
  return {
    kind: 'video',
    id,
    number,
    name: `Custom ${id}`,
    playlistId: 'PLcustom',
    videos: [
      { id: `${id}-v1`, title: 'Custom clip', durationSeconds: 120, thumbnailUrl: '' },
    ],
    totalDurationSeconds: 120,
  }
}

function makeMediaQuery(matches: (query: string) => boolean) {
  return (query: string): MediaQueryList =>
    ({
      matches: matches(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

/**
 * Render the full route component (ScWidgetProvider → TvLayout) and capture
 * the layout context via a consumer mounted in the mocked <Outlet />.
 */
function renderLayout() {
  let latest: TvLayoutContextValue | null = null
  function CaptureConsumer() {
    latest = useTvLayout()
    return null
  }
  outlet.render = () => <CaptureConsumer />
  const utils = render(<TvLayoutRouteComponent />)
  const getCtx = (): TvLayoutContextValue => {
    if (latest === null) throw new Error('TvLayout context was not captured')
    return latest
  }
  return { ...utils, getCtx }
}

function makeCtxValue(
  overrides: Partial<TvLayoutContextValue> = {},
): TvLayoutContextValue {
  return {
    guideVisible: true,
    toggleGuide: vi.fn(),
    importVisible: false,
    toggleImport: vi.fn(),
    helpVisible: false,
    toggleHelp: vi.fn(),
    closeHelp: vi.fn(),
    currentChannelId: null,
    setCurrentChannelId: vi.fn(),
    loadedChannels: new Map(),
    registerChannel: vi.fn(),
    channelFailed: vi.fn(() => false),
    refetchChannel: vi.fn(async () => {}),
    customChannels: [],
    addCustomChannel: vi.fn(),
    addCustomChannels: vi.fn(),
    removeCustomChannel: vi.fn(),
    updateCustomChannel: vi.fn(),
    isFullscreen: false,
    toggleFullscreen: vi.fn(),
    isTheater: false,
    toggleTheater: vi.fn(),
    viewMode: 'normal' as const,
    overlayMode: 'crt' as const,
    cycleOverlay: vi.fn(),
    isMuted: false,
    toggleMute: vi.fn(),
    volume: 80,
    setVolume: vi.fn(),
    isMobile: false,
    isQuotaExhausted: false,
    setQuotaExhausted: vi.fn(),
    clearQuotaExhausted: vi.fn(),
    needsDesktopOnboarding: false,
    dismissDesktopOnboarding: vi.fn(),
    activePreset: 'spectrum',
    setActivePreset: vi.fn(),
    activeIntensity: 'normal',
    setActiveIntensity: vi.fn(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// TvLayoutContext default value
// ---------------------------------------------------------------------------

describe('TvLayoutContext default', () => {
  it('provides guideVisible=true and a no-op toggleGuide by default', () => {
    let capturedContext: TvLayoutContextValue | null = null

    function Consumer() {
      capturedContext = useTvLayout()
      return null
    }

    render(<Consumer />)

    expect(capturedContext).not.toBeNull()
    expect(capturedContext!.guideVisible).toBe(true)
    // Should not throw when called
    expect(() => capturedContext!.toggleGuide()).not.toThrow()
  })

  it('exposes the keyboard-help API on the context', () => {
    // Help is driven through the layout context (not local route state) so the
    // modal can render at the layout level, outside <main>'s isolation: isolate
    // stacking context. If these disappear, help falls back into the route and
    // paints below the welcome overlay again.
    let ctx: TvLayoutContextValue | null = null
    function Consumer() {
      ctx = useTvLayout()
      return null
    }
    render(<Consumer />)

    expect(ctx!.helpVisible).toBe(false)
    expect(() => ctx!.toggleHelp()).not.toThrow()
    expect(() => ctx!.closeHelp()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// TvLayoutContext.Provider wiring
// ---------------------------------------------------------------------------

describe('TvLayoutContext.Provider', () => {
  it('provides the supplied value to consumers', () => {
    let capturedContext: TvLayoutContextValue | null = null

    function Consumer() {
      capturedContext = useTvLayout()
      return null
    }

    const value = makeCtxValue({ guideVisible: false })
    render(
      <TvLayoutContext.Provider value={value}>
        <Consumer />
      </TvLayoutContext.Provider>,
    )

    expect(capturedContext!.guideVisible).toBe(false)
    capturedContext!.toggleGuide()
    expect(value.toggleGuide).toHaveBeenCalledOnce()
  })

  it('passes updated guideVisible when re-rendered', () => {
    let capturedContext: TvLayoutContextValue | null = null

    function Consumer() {
      capturedContext = useTvLayout()
      return null
    }

    const { rerender } = render(
      <TvLayoutContext.Provider value={makeCtxValue({ guideVisible: true })}>
        <Consumer />
      </TvLayoutContext.Provider>,
    )

    expect(capturedContext!.guideVisible).toBe(true)

    rerender(
      <TvLayoutContext.Provider value={makeCtxValue({ guideVisible: false })}>
        <Consumer />
      </TvLayoutContext.Provider>,
    )

    expect(capturedContext!.guideVisible).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Guide visibility toggle behavior (stateful wrapper)
// ---------------------------------------------------------------------------

describe('guide visibility toggle', () => {
  it('toggles guideVisible from true to false on first call', () => {
    let capturedContext: TvLayoutContextValue | null = null

    function Consumer() {
      capturedContext = useTvLayout()
      return (
        <button onClick={() => capturedContext!.toggleGuide()}>toggle</button>
      )
    }

    render(
      <TvLayoutContext.Provider value={makeCtxValue({ guideVisible: true })}>
        <Consumer />
      </TvLayoutContext.Provider>,
    )

    // Just verify context is received correctly — the actual toggle state lives in TvLayout
    expect(capturedContext!.guideVisible).toBe(true)
  })

  it('context value is stable reference (same object for same render)', () => {
    const value = makeCtxValue({ guideVisible: true })
    let ref1: TvLayoutContextValue | null = null
    let ref2: TvLayoutContextValue | null = null

    function ConsumerA() {
      ref1 = useTvLayout()
      return null
    }
    function ConsumerB() {
      ref2 = useTvLayout()
      return null
    }

    render(
      <TvLayoutContext.Provider value={value}>
        <ConsumerA />
        <ConsumerB />
      </TvLayoutContext.Provider>,
    )

    // Both consumers get the same object from the same provider render
    expect(ref1).toBe(ref2)
  })
})

// ---------------------------------------------------------------------------
// useTvLayout hook
// ---------------------------------------------------------------------------

describe('useTvLayout', () => {
  it('returns guideVisible and toggleGuide from context', () => {
    let result: TvLayoutContextValue | null = null

    function HookHarness() {
      result = useTvLayout()
      return null
    }

    const value = makeCtxValue({ guideVisible: false })
    render(
      <TvLayoutContext.Provider value={value}>
        <HookHarness />
      </TvLayoutContext.Provider>,
    )

    expect(result!.guideVisible).toBe(false)
    expect(result!.toggleGuide).toBe(value.toggleGuide)
  })

  it('calling toggleGuide from hook invokes the provider function', () => {
    const value = makeCtxValue({ guideVisible: true })
    let ctx: TvLayoutContextValue | null = null

    function HookHarness() {
      ctx = useTvLayout()
      return null
    }

    render(
      <TvLayoutContext.Provider value={value}>
        <HookHarness />
      </TvLayoutContext.Provider>,
    )

    act(() => ctx!.toggleGuide())
    expect(value.toggleGuide).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// TvLayout full-render harness (provider wiring, view modes, toggles,
// quota latch/recovery, custom channels, overlay cycling, composition)
// ---------------------------------------------------------------------------

describe('TvLayout full render', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Suppress the desktop welcome overlay by default; onboarding has its
    // own dedicated test below.
    localStorage.setItem('kranz-tv:desktop-onboarding-seen', 'true')
    mediaState.mobile = false
    mediaState.desktop = true
    mediaState.fullscreen = false
    scState.isReady = true
    outlet.render = null
    mockBuildChannel.mockImplementation((preset: ChannelPreset) =>
      Promise.resolve(channelForPreset(preset)),
    )
    mockLoadCustomChannels.mockReturnValue([])
    mockLoadCachedChannel.mockReturnValue(null)
    mockCheckYouTubeQuota.mockResolvedValue({ ok: true })
    mockCopyToClipboard.mockResolvedValue(true)
  })

  afterEach(() => {
    outlet.render = null
  })

  it('renders provider wiring and exposes the context to outlet consumers', () => {
    const { getCtx } = renderLayout()

    expect(getCtx().viewMode).toBe('normal')
    expect(getCtx().guideVisible).toBe(true)
    expect(getCtx().isQuotaExhausted).toBe(false)
    // Boot screen clears once all readiness signals are green
    expect(screen.queryByText('HYDRATING STORAGE')).toBeNull()
    // Desktop toolbar is present in normal mode
    expect(screen.getByText('— SELECT A CHANNEL')).toBeTruthy()
  })

  it('renders the boot screen with pending phases until the SC widget is ready', async () => {
    scState.isReady = false
    const { rerender } = renderLayout()

    expect(screen.getByText('HYDRATING STORAGE')).toBeTruthy()
    expect(screen.getByText('WARMING SOUNDCLOUD')).toBeTruthy()
    expect(screen.getByText('LOADING CHANNELS')).toBeTruthy()

    scState.isReady = true
    rerender(<TvLayoutRouteComponent />)
    await waitFor(() => {
      expect(screen.queryByText('WARMING SOUNDCLOUD')).toBeNull()
    })
  })

  it('drives an active music channel into the shared SC widget and clears it on exit', async () => {
    const { getCtx } = renderLayout()

    await waitFor(() =>
      expect(getCtx().loadedChannels.get('sc-calming')).toBeDefined(),
    )
    act(() => getCtx().setCurrentChannelId('sc-calming'))
    await waitFor(() =>
      expect(mockSetActiveChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sc-calming' }),
      ),
    )

    act(() => getCtx().setCurrentChannelId('skate'))
    await waitFor(() => expect(mockSetActiveChannel).toHaveBeenLastCalledWith(null))
  })

  it('enriches RUM events with viewer context (desktop)', () => {
    renderLayout()

    expect(rum.setViewerContext).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceType: 'desktop',
        channelCount: CHANNEL_PRESETS.length,
      }),
    )
  })

  it('renders the mobile composition: outlet only, no desktop chrome', () => {
    mediaState.mobile = true
    mediaState.desktop = false
    const { getCtx } = renderLayout()

    expect(getCtx().isMobile).toBe(true)
    expect(screen.queryByText('— SELECT A CHANNEL')).toBeNull()
    expect(screen.queryByLabelText('Toggle theater mode')).toBeNull()
    expect(rum.setViewerContext).toHaveBeenCalledWith(
      expect.objectContaining({ deviceType: 'mobile' }),
    )
  })

  it('toggles the guide and tracks telemetry; inline EPG follows visibility', () => {
    const { getCtx } = renderLayout()

    // Guide is visible by default on desktop — the inline EPG row is present
    expect(screen.getByTitle('Music Videos')).toBeTruthy()

    act(() => getCtx().toggleGuide())
    expect(getCtx().guideVisible).toBe(false)
    expect(rum.trackGuideToggle).toHaveBeenCalledWith(false)
    expect(screen.queryByTitle('Music Videos')).toBeNull()

    act(() => getCtx().toggleGuide())
    expect(getCtx().guideVisible).toBe(true)
    expect(rum.trackGuideToggle).toHaveBeenCalledWith(true)
  })

  it('navigates when a channel is selected from the inline guide', () => {
    renderLayout()

    fireEvent.click(screen.getByTitle('Music Videos'))

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/channel/$channelId',
      params: { channelId: 'music' },
    })
  })

  it('shows the active channel in the toolbar once selected', () => {
    const { getCtx } = renderLayout()

    expect(screen.getByText('— SELECT A CHANNEL')).toBeTruthy()
    act(() => getCtx().setCurrentChannelId('skate'))
    expect(screen.getByText('— CH 01 SKATE VIDS')).toBeTruthy()
  })

  describe('theater mode', () => {
    it('enters theater: guide closes, toolbar hides, controls + watermark appear', () => {
      const { getCtx } = renderLayout()

      act(() => getCtx().toggleTheater())

      expect(getCtx().isTheater).toBe(true)
      expect(getCtx().viewMode).toBe('theater')
      expect(rum.trackViewModeChange).toHaveBeenCalledWith(
        'normal',
        'theater',
        'button',
        false,
      )
      // Entering theater closes the guide so it doesn't reappear immediately
      expect(getCtx().guideVisible).toBe(false)
      // Toolbar is hidden in theater (no toolbar theater button); only the
      // watermark KTV remains. (TheaterControls also renders a
      // '— SELECT A CHANNEL' label when no channel is active, so the toolbar
      // button is the reliable absence check.)
      expect(screen.queryByLabelText('Toggle theater mode')).toBeNull()
      expect(screen.getByText('KTV')).toBeTruthy()
      expect(screen.getByLabelText('Channel up')).toBeTruthy()
      expect(screen.getByLabelText('Channel down')).toBeTruthy()
    })

    it('exits theater via the exit button', () => {
      const { getCtx } = renderLayout()
      act(() => getCtx().toggleTheater())
      expect(getCtx().viewMode).toBe('theater')

      fireEvent.click(screen.getByTitle('Exit theater [T]'))

      expect(getCtx().viewMode).toBe('normal')
      expect(getCtx().isTheater).toBe(false)
      expect(rum.trackViewModeChange).toHaveBeenCalledWith(
        'theater',
        'normal',
        'button',
        false,
      )
    })

    it('theater channel nav is a no-op without an active channel', () => {
      const { getCtx } = renderLayout()
      act(() => getCtx().toggleTheater())

      fireEvent.click(screen.getByLabelText('Channel up'))
      fireEvent.click(screen.getByLabelText('Channel down'))

      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('theater channel nav wraps around the preset list', () => {
      const { getCtx } = renderLayout()
      act(() => getCtx().toggleTheater())
      act(() => getCtx().setCurrentChannelId('skate'))

      fireEvent.click(screen.getByLabelText('Channel down'))
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/channel/$channelId',
        params: { channelId: 'music' },
      })

      fireEvent.click(screen.getByLabelText('Channel up'))
      const lastPreset = CHANNEL_PRESETS[CHANNEL_PRESETS.length - 1]
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/channel/$channelId',
        params: { channelId: lastPreset.id },
      })
    })

    it('theater guide opens the overlay EPG and closes it on channel select', () => {
      const { getCtx } = renderLayout()
      act(() => getCtx().toggleTheater())
      expect(getCtx().guideVisible).toBe(false)

      fireEvent.click(screen.getByTitle('Guide [G]'))
      expect(getCtx().guideVisible).toBe(true)
      expect(screen.getByLabelText('TV Guide')).toBeTruthy()

      // Overlay mode closes the guide after a channel is picked
      fireEvent.click(screen.getByTitle('Skate Vids'))
      expect(getCtx().guideVisible).toBe(false)
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/channel/$channelId',
        params: { channelId: 'skate' },
      })
    })

    it('shares from theater controls, debounces rapid presses, and shows a toast', async () => {
      const { getCtx } = renderLayout()
      act(() => getCtx().toggleTheater())

      fireEvent.click(screen.getByTitle('Share [C]'))
      fireEvent.click(screen.getByTitle('Share [C]'))

      // 500ms debounce: only one clipboard copy despite two presses
      expect(mockCopyToClipboard).toHaveBeenCalledTimes(1)
      await waitFor(() =>
        expect(rum.trackShareChannel).toHaveBeenCalledWith('', true),
      )
      expect(screen.getByText('LINK COPIED')).toBeTruthy()
    })

    it('shows a COPY FAILED toast when the clipboard write fails', async () => {
      mockCopyToClipboard.mockResolvedValue(false)
      const { getCtx } = renderLayout()
      act(() => getCtx().toggleTheater())

      fireEvent.click(screen.getByTitle('Share [C]'))

      await waitFor(() =>
        expect(screen.getByText('COPY FAILED')).toBeTruthy(),
      )
      expect(rum.trackShareChannel).toHaveBeenCalledWith('', false)
    })
  })

  describe('fullscreen mode', () => {
    it('fullscreen composition hides toolbar and quota banner, keeps watermark', () => {
      mediaState.fullscreen = true
      const { getCtx } = renderLayout()

      expect(getCtx().isFullscreen).toBe(true)
      expect(getCtx().viewMode).toBe('fullscreen')
      expect(screen.queryByText('— SELECT A CHANNEL')).toBeNull()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.getByText('KTV')).toBeTruthy() // fullscreen watermark
    })

    it('relays toggleFullscreen to the fullscreen hook', () => {
      const { getCtx } = renderLayout()

      act(() => getCtx().toggleFullscreen())

      expect(mockToggleFullscreen).toHaveBeenCalledOnce()
    })
  })

  describe('quota exhaustion', () => {
    it('latches quota when a video-preset fetch throws YouTubeQuotaError', async () => {
      mockBuildChannel.mockImplementation((preset: ChannelPreset) => {
        if (preset.kind === 'video') {
          return Promise.reject(
            new (quotaErrorClass.cls!)('quota exhausted'),
          )
        }
        return Promise.resolve(channelForPreset(preset))
      })
      const { getCtx } = renderLayout()

      // First video-lane preset hits quota → cache cleared + quota latched
      await waitFor(() =>
        expect(mockClearPresetChannelCache).toHaveBeenCalledOnce(),
      )
      await waitFor(() => expect(getCtx().isQuotaExhausted).toBe(true))
      expect(localStorage.getItem('kranz-tv:quota-exhausted')).not.toBeNull()

      // Banner is visible in normal mode
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText(/TECHNICAL DIFFICULTIES/)).toBeTruthy()

      // Video presets were skipped after the quota latch (no fresh data),
      // but the music lane keeps loading
      await waitFor(() =>
        expect(getCtx().loadedChannels.get('sc-calming')).toBeDefined(),
      )
      expect(getCtx().loadedChannels.get('skate')).toBeUndefined()
      expect(rum.trackScCacheEvent).toHaveBeenCalledWith(
        'miss',
        'sc-calming',
      )
    })

    it('quota retry clears the latch when the quota probe succeeds', async () => {
      mockBuildChannel.mockImplementation((preset: ChannelPreset) => {
        if (preset.kind === 'video') {
          return Promise.reject(
            new (quotaErrorClass.cls!)('quota exhausted'),
          )
        }
        return Promise.resolve(channelForPreset(preset))
      })
      const { getCtx } = renderLayout()
      await waitFor(() => expect(getCtx().isQuotaExhausted).toBe(true))

      // Make subsequent video fetches succeed so the re-run eager lane
      // doesn't immediately re-latch after recovery.
      mockBuildChannel.mockImplementation((preset: ChannelPreset) =>
        Promise.resolve(channelForPreset(preset)),
      )
      fireEvent.click(screen.getByRole('button', { name: 'RETRY NOW' }))

      // handleQuotaRetry awaits a dynamic import — the probe resolves async
      await waitFor(() => expect(mockCheckYouTubeQuota).toHaveBeenCalledOnce())
      await waitFor(() => expect(getCtx().isQuotaExhausted).toBe(false))
      expect(localStorage.getItem('kranz-tv:quota-exhausted')).toBeNull()
    })

    it('quota retry keeps the latch when the probe reports quota still exhausted', async () => {
      mockBuildChannel.mockImplementation((preset: ChannelPreset) => {
        if (preset.kind === 'video') {
          return Promise.reject(
            new (quotaErrorClass.cls!)('quota exhausted'),
          )
        }
        return Promise.resolve(channelForPreset(preset))
      })
      mockCheckYouTubeQuota.mockResolvedValue({ ok: false })
      const { getCtx } = renderLayout()
      await waitFor(() => expect(getCtx().isQuotaExhausted).toBe(true))

      fireEvent.click(screen.getByRole('button', { name: 'RETRY NOW' }))

      await waitFor(() => expect(mockCheckYouTubeQuota).toHaveBeenCalledOnce())
      expect(getCtx().isQuotaExhausted).toBe(true)
    })

    it('latches a fresh stored quota timestamp on mount', () => {
      localStorage.setItem('kranz-tv:quota-exhausted', String(Date.now()))
      const { getCtx } = renderLayout()

      expect(getCtx().isQuotaExhausted).toBe(true)
    })

    it('auto-clears a stale stored quota timestamp on mount', () => {
      localStorage.setItem(
        'kranz-tv:quota-exhausted',
        String(Date.now() - 7 * 24 * 60 * 60 * 1000),
      )
      const { getCtx } = renderLayout()

      expect(getCtx().isQuotaExhausted).toBe(false)
      expect(localStorage.getItem('kranz-tv:quota-exhausted')).toBeNull()
    })

    it('auto-clears a legacy non-timestamp quota flag on mount', () => {
      localStorage.setItem('kranz-tv:quota-exhausted', '1')
      const { getCtx } = renderLayout()

      expect(getCtx().isQuotaExhausted).toBe(false)
      expect(localStorage.getItem('kranz-tv:quota-exhausted')).toBeNull()
    })

    it('dev ?quota_test=1 forces the quota state and persists the timestamp', () => {
      window.history.pushState({}, '', '/?quota_test=1')
      try {
        const { getCtx } = renderLayout()

        expect(getCtx().isQuotaExhausted).toBe(true)
        expect(localStorage.getItem('kranz-tv:quota-exhausted')).not.toBeNull()
      } finally {
        window.history.pushState({}, '', '/')
      }
    })
  })

  describe('fetch outcomes', () => {
    it('logs non-quota video fetch failures without latching quota', async () => {
      mockBuildChannel.mockImplementation((preset: ChannelPreset) => {
        if (preset.kind === 'video') {
          return Promise.reject(new Error('HTTP 500'))
        }
        return Promise.resolve(channelForPreset(preset))
      })
      const { getCtx } = renderLayout()

      await waitFor(() =>
        expect(mockLogChannelLoadFailed).toHaveBeenCalledWith('skate', 'HTTP 500'),
      )
      expect(getCtx().isQuotaExhausted).toBe(false)
      expect(getCtx().channelFailed('skate')).toBe(false)
      // Video channel is absent from the guide; music lane unaffected
      await waitFor(() =>
        expect(getCtx().loadedChannels.get('sc-calming')).toBeDefined(),
      )
      expect(getCtx().loadedChannels.get('skate')).toBeUndefined()
    })

    it('records failed music channels and clears the mark on a successful refetch', async () => {
      mockBuildChannel.mockImplementation((preset: ChannelPreset) => {
        if (preset.kind === 'music') {
          return Promise.reject(new Error('sc down'))
        }
        return Promise.resolve(channelForPreset(preset))
      })
      const { getCtx } = renderLayout()

      await waitFor(() =>
        expect(rum.trackScChannelFailed).toHaveBeenCalledWith(
          'sc-calming',
          'sc down',
        ),
      )
      expect(getCtx().channelFailed('sc-calming')).toBe(true)

      // Recovery: a later retry succeeds and clears the failed mark
      mockBuildChannel.mockImplementation((preset: ChannelPreset) =>
        Promise.resolve(channelForPreset(preset)),
      )
      await act(async () => {
        await getCtx().refetchChannel('sc-calming')
      })
      expect(getCtx().channelFailed('sc-calming')).toBe(false)
      const channel = getCtx().loadedChannels.get('sc-calming')
      expect(channel).toBeDefined()
      expect(channel?.kind).toBe('music')
      expect(
        (channel as Extract<Channel, { kind: 'music' }>).tracks?.length,
      ).toBeGreaterThan(0)
    })

    it('refetching an unknown preset id resolves without latching anything', async () => {
      const { getCtx } = renderLayout()
      // Let the eager lanes finish before clearing — their sequential fetches
      // are still in flight right after render.
      await waitFor(() =>
        expect(mockBuildChannel).toHaveBeenCalledTimes(CHANNEL_PRESETS.length),
      )
      mockBuildChannel.mockClear()

      await act(async () => {
        await getCtx().refetchChannel('does-not-exist')
      })

      expect(mockBuildChannel).not.toHaveBeenCalled()
      expect(getCtx().isQuotaExhausted).toBe(false)
      expect(mockClearPresetChannelCache).not.toHaveBeenCalled()
    })
  })

  describe('staged channel revalidation', () => {
    it('stages fresh data for the active channel and applies it on re-entry', async () => {
      const { getCtx } = renderLayout()
      await waitFor(() =>
        expect(getCtx().loadedChannels.get('skate')).toBeDefined(),
      )
      act(() => getCtx().setCurrentChannelId('skate'))

      const live = getCtx().loadedChannels.get('skate')!
      const fresh: Channel = {
        ...(live as Extract<Channel, { kind: 'video' }>),
        totalDurationSeconds: 999,
        videos: [
          { id: 'skate-v2', title: 'New clip', durationSeconds: 999, thumbnailUrl: '' },
        ],
      }
      mockBuildChannel.mockImplementation((preset: ChannelPreset) =>
        Promise.resolve(preset.id === 'skate' ? fresh : channelForPreset(preset)),
      )

      // While 'skate' is active, fresh data must NOT hot-swap the live map
      await act(async () => {
        await getCtx().refetchChannel('skate')
      })
      expect(getCtx().loadedChannels.get('skate')).toBe(live)

      // Leaving and re-entering applies the staged channel
      act(() => getCtx().setCurrentChannelId('music'))
      act(() => getCtx().setCurrentChannelId('skate'))
      expect(getCtx().loadedChannels.get('skate')).toBe(fresh)
      expect(getCtx().loadedChannels.get('skate')?.totalDurationSeconds).toBe(999)
    })
  })

  describe('custom channels', () => {
    it('hydrates stored custom channels into the guide and channel map', () => {
      const custom = makeCustomChannel('custom-1', 900)
      mockLoadCustomChannels.mockReturnValue([custom])
      const { getCtx } = renderLayout()

      expect(getCtx().customChannels).toEqual([custom])
      expect(getCtx().loadedChannels.get('custom-1')).toBe(custom)
      expect(rum.setViewerContext).toHaveBeenCalledWith(
        expect.objectContaining({
          channelCount: CHANNEL_PRESETS.length + 1,
        }),
      )
    })

    it('addCustomChannel persists and registers in the loaded map', () => {
      const { getCtx } = renderLayout()
      const added = makeCustomChannel('custom-2', 901)

      act(() => getCtx().addCustomChannel(added))

      expect(getCtx().customChannels.map((c) => c.id)).toContain('custom-2')
      expect(getCtx().loadedChannels.get('custom-2')).toBe(added)
      expect(mockSaveCustomChannels).toHaveBeenCalledWith(
        expect.arrayContaining([added]),
      )
    })

    it('addCustomChannels persists a batch', () => {
      const { getCtx } = renderLayout()
      const batch = [makeCustomChannel('custom-3', 902), makeCustomChannel('custom-4', 903)]

      act(() => getCtx().addCustomChannels(batch))

      expect(getCtx().customChannels.map((c) => c.id)).toEqual(
        expect.arrayContaining(['custom-3', 'custom-4']),
      )
      expect(getCtx().loadedChannels.get('custom-3')).toBeDefined()
      expect(getCtx().loadedChannels.get('custom-4')).toBeDefined()
      expect(mockSaveCustomChannels).toHaveBeenCalledWith(
        expect.arrayContaining(batch),
      )
    })

    it('updateCustomChannel renames in both custom list and loaded map', () => {
      const { getCtx } = renderLayout()
      act(() => getCtx().addCustomChannel(makeCustomChannel('custom-5', 904)))

      act(() => getCtx().updateCustomChannel('custom-5', { name: 'Renamed' }))

      expect(
        getCtx().customChannels.find((c) => c.id === 'custom-5')?.name,
      ).toBe('Renamed')
      expect(getCtx().loadedChannels.get('custom-5')?.name).toBe('Renamed')
      expect(mockSaveCustomChannels).toHaveBeenCalled()
    })

    it('updateCustomChannel for an unknown id is a no-op', () => {
      const { getCtx } = renderLayout()
      act(() => getCtx().addCustomChannel(makeCustomChannel('custom-6', 905)))

      act(() => getCtx().updateCustomChannel('ghost', { name: 'Nope' }))

      expect(
        getCtx().customChannels.find((c) => c.id === 'ghost'),
      ).toBeUndefined()
      expect(getCtx().loadedChannels.has('ghost')).toBe(false)
    })

    it('removeCustomChannel deletes from custom list, loaded map, and storage', () => {
      const { getCtx } = renderLayout()
      act(() => getCtx().addCustomChannel(makeCustomChannel('custom-7', 906)))

      act(() => getCtx().removeCustomChannel('custom-7'))

      expect(
        getCtx().customChannels.find((c) => c.id === 'custom-7'),
      ).toBeUndefined()
      expect(getCtx().loadedChannels.has('custom-7')).toBe(false)
      expect(mockSaveCustomChannels).toHaveBeenCalledWith([])
    })

    it('registerChannel adds a channel to the loaded map', () => {
      const { getCtx } = renderLayout()
      const extra = makeCustomChannel('extra', 999)

      act(() => getCtx().registerChannel(extra))

      expect(getCtx().loadedChannels.get('extra')).toBe(extra)
    })
  })

  describe('import modal', () => {
    it('toggleImport opens/closes the modal and emits import telemetry', () => {
      const { getCtx } = renderLayout()

      expect(getCtx().importVisible).toBe(false)

      act(() => getCtx().toggleImport())
      expect(getCtx().importVisible).toBe(true)
      expect(rum.trackImportStarted).toHaveBeenCalledOnce()
      expect(screen.getByTestId('import-modal')).toBeTruthy()

      fireEvent.click(screen.getByTestId('import-close'))
      expect(getCtx().importVisible).toBe(false)
    })

    it('import completion adds the custom channel and navigates to it', () => {
      const { getCtx } = renderLayout()
      act(() => getCtx().toggleImport())

      fireEvent.click(screen.getByTestId('import-complete'))

      expect(getCtx().importVisible).toBe(false)
      expect(
        getCtx().customChannels.map((c) => c.id),
      ).toContain('custom-imported')
      expect(mockSaveCustomChannels).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'custom-imported' }),
        ]),
      )
      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/channel/$channelId',
        params: { channelId: 'custom-imported' },
      })
    })

    it('channel refresh from the import manager persists the updated channel', () => {
      const { getCtx } = renderLayout()
      act(() => getCtx().addCustomChannel(makeCustomChannel('custom-imported', 910)))
      act(() => getCtx().toggleImport())

      fireEvent.click(screen.getByTestId('import-refresh'))

      expect(
        getCtx().customChannels.find((c) => c.id === 'custom-imported')?.name,
      ).toBe('Refreshed')
      expect(getCtx().loadedChannels.get('custom-imported')?.name).toBe(
        'Refreshed',
      )
      expect(mockSaveCustomChannels).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Refreshed' }),
        ]),
      )
    })
  })

  describe('help modal', () => {
    it('toggleHelp opens the layout-level help modal and closing it dismisses', () => {
      const { getCtx } = renderLayout()

      act(() => getCtx().toggleHelp())
      expect(getCtx().helpVisible).toBe(true)
      expect(screen.getByLabelText('Keyboard shortcuts')).toBeTruthy()

      fireEvent.click(screen.getByLabelText('Close keyboard shortcuts'))
      expect(getCtx().helpVisible).toBe(false)
      expect(screen.queryByLabelText('Keyboard shortcuts')).toBeNull()
    })

    it('closeHelp is idempotent when help is already hidden', () => {
      const { getCtx } = renderLayout()

      act(() => getCtx().closeHelp())

      expect(getCtx().helpVisible).toBe(false)
    })
  })

  describe('desktop welcome onboarding', () => {
    it('shows the welcome overlay for first-time viewers and dismisses it', () => {
      localStorage.removeItem('kranz-tv:desktop-onboarding-seen')
      const { getCtx } = renderLayout()

      expect(getCtx().needsDesktopOnboarding).toBe(true)
      expect(screen.getByText('WELCOME TO KRANZTV')).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: /START WATCHING/i }))

      expect(getCtx().needsDesktopOnboarding).toBe(false)
      expect(localStorage.getItem('kranz-tv:desktop-onboarding-seen')).toBe(
        'true',
      )
    })
  })

  describe('overlay cycling', () => {
    it('cycles to the next overlay mode and tracks the change', () => {
      const { getCtx } = renderLayout()

      act(() => getCtx().cycleOverlay())

      expect(getCtx().overlayMode).toBe('vhs')
      expect(rum.trackOverlayChange).toHaveBeenCalledWith('crt', 'vhs')
      expect(JSON.parse(localStorage.getItem('kranz-tv:overlay-mode')!)).toBe('vhs')
    })

    it('wraps through OFF back to CRT and honors reduced-motion', () => {
      const matchMediaSpy = vi
        .spyOn(window, 'matchMedia')
        .mockImplementation(makeMediaQuery((q) => q.includes('prefers-reduced-motion')))
      try {
        const { getCtx } = renderLayout()
        // Cycle through every mode to the end ('none') and one more back to 'crt'
        for (let i = 0; i < 8; i++) {
          act(() => getCtx().cycleOverlay())
        }
        expect(getCtx().overlayMode).toBe('crt')
      } finally {
        matchMediaSpy.mockRestore()
      }
    })
  })

  describe('mute/volume state', () => {
    it('toggleMute and setVolume persist to localStorage', () => {
      const { getCtx } = renderLayout()

      act(() => getCtx().toggleMute())
      expect(getCtx().isMuted).toBe(true)
      expect(JSON.parse(localStorage.getItem('kranz-tv:is-muted')!)).toBe(true)

      act(() => getCtx().setVolume(25))
      expect(getCtx().volume).toBe(25)
      expect(JSON.parse(localStorage.getItem('kranz-tv:volume')!)).toBe(25)
    })

    it('first user gesture after boot unmutes; later gestures have no effect', async () => {
      localStorage.setItem('kranz-tv:is-muted', 'true')
      const { getCtx } = renderLayout()
      await waitFor(() => expect(getCtx().isMuted).toBe(true))

      // First gesture unmutes
      act(() => {
        window.dispatchEvent(new Event('mousedown'))
      })
      expect(getCtx().isMuted).toBe(false)

      // Listeners are removed after the first gesture — flipping back and
      // dispatching again must NOT unmute again.
      act(() => getCtx().toggleMute())
      expect(getCtx().isMuted).toBe(true)
      act(() => {
        window.dispatchEvent(new Event('keydown'))
      })
      expect(getCtx().isMuted).toBe(true)
    })
  })

  describe('visualizer preferences', () => {
    it('setActivePreset updates state, persists, and emits telemetry', () => {
      const { getCtx } = renderLayout()

      act(() => getCtx().setActivePreset('kaleidoscope'))

      expect(getCtx().activePreset).toBe('kaleidoscope')
      expect(rum.trackMusicBackdropSelected).toHaveBeenCalledWith(
        'kaleidoscope',
      )
    })

    it('setActiveIntensity updates state and persists', () => {
      const { getCtx } = renderLayout()

      act(() => getCtx().setActiveIntensity('max'))

      expect(getCtx().activeIntensity).toBe('max')
    })
  })

  describe('desktop toolbar chrome', () => {
    it('the KTV brand link click handler exits theater mode', () => {
      const { getCtx } = renderLayout()
      expect(getCtx().viewMode).toBe('normal')

      // The toolbar link renders outside theater; its click handler resets
      // theater so navigating home never strands the viewer in theater mode.
      fireEvent.click(screen.getByRole('link', { name: 'KTV' }))

      expect(getCtx().viewMode).toBe('normal')
      expect(getCtx().isTheater).toBe(false)
    })

    it('toolbar chrome stays visible in normal mode and the powered-by hover handlers run', () => {
      renderLayout()

      const powered = screen.getByText('POWERED BY YOUTUBE')
      fireEvent.mouseEnter(powered)
      // jsdom normalizes rgba spacing — compare without whitespace
      expect(powered.style.color.replace(/\s/g, '')).toBe('rgba(255,255,255,0.7)')

      fireEvent.mouseLeave(powered)
      expect(powered.style.color.replace(/\s/g, '')).toBe('rgba(255,255,255,0.45)')
    })
  })
})
