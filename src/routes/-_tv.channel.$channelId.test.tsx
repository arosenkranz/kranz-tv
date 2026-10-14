import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'

import { ChannelView } from './_tv.channel.$channelId'
import * as channelViewModule from './_tv.channel.$channelId'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockUseCurrentProgram,
  mockUseChannelNavigation,
  mockUseKeyboardControls,
  mockUseTvLayout,
  mockTvPlayer,
  mockRefetchChannel,
  mockTrackRetry,
  mockTrackChannelSwitch,
  mockTrackKeyboardShortcut,
  mockTrackShareChannel,
  mockCopyToClipboard,
  mockLogChannelLoadFailed,
  mockLoadCustomChannels,
  mockNavigate,
  mockMobileView,
} = vi.hoisted(() => ({
  mockUseCurrentProgram: vi.fn(),
  mockUseChannelNavigation: vi.fn(),
  mockUseKeyboardControls: vi.fn(),
  mockUseTvLayout: vi.fn(),
  mockTvPlayer: vi.fn(),
  mockUseParams: vi.fn(),
  mockRefetchChannel: vi.fn(() => Promise.resolve()),
  mockTrackRetry: vi.fn(),
  mockTrackChannelSwitch: vi.fn(),
  mockTrackKeyboardShortcut: vi.fn(),
  mockTrackShareChannel: vi.fn(),
  mockCopyToClipboard: vi.fn(),
  mockLogChannelLoadFailed: vi.fn(),
  mockLoadCustomChannels: vi.fn(),
  mockNavigate: vi.fn(),
  mockMobileView: vi.fn(),
}))

vi.mock('~/lib/clipboard', () => ({
  copyToClipboard: mockCopyToClipboard,
}))

vi.mock('~/lib/datadog/logs', async (orig) => {
  const actual = await orig<typeof import('~/lib/datadog/logs')>()
  return { ...actual, logChannelLoadFailed: mockLogChannelLoadFailed }
})

vi.mock('~/components/mobile/mobile-view', () => ({
  MobileView: mockMobileView,
}))

vi.mock('~/lib/storage/local-channels', () => ({
  loadCustomChannels: mockLoadCustomChannels,
}))

vi.mock('~/hooks/use-current-program', () => ({
  useCurrentProgram: mockUseCurrentProgram,
}))

vi.mock('~/hooks/use-channel-navigation', () => ({
  useChannelNavigation: mockUseChannelNavigation,
}))

vi.mock('~/hooks/use-keyboard-controls', () => ({
  useKeyboardControls: mockUseKeyboardControls,
}))

vi.mock('~/routes/_tv', () => ({
  useTvLayout: mockUseTvLayout,
}))

vi.mock('~/components/tv-player', () => ({
  TvPlayer: mockTvPlayer,
}))

vi.mock('~/lib/sources/soundcloud/sc-widget-context', () => ({
  useScWidget: () => ({
    widget: null,
    status: 'mounting',
    activeChannelId: null,
    isReady: false,
    setActiveChannel: vi.fn(),
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (opts: unknown) => opts,
  useNavigate: () => mockNavigate,
}))

vi.mock('~/lib/datadog/rum', async (orig) => {
  const actual = await orig<typeof import('~/lib/datadog/rum')>()
  return {
    ...actual,
    trackScChannelRetry: mockTrackRetry,
    trackChannelSwitch: mockTrackChannelSwitch,
    trackKeyboardShortcut: mockTrackKeyboardShortcut,
    trackShareChannel: mockTrackShareChannel,
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeChannel = (id = 'skate'): Channel => ({
  kind: 'video',
  id,
  number: 1,
  name: 'Skate Vids',
  playlistId: 'PL123',
  videos: [
    { id: 'v1', title: 'Skate Clip', durationSeconds: 300, thumbnailUrl: '' },
  ],
  totalDurationSeconds: 300,
})

const makePosition = (): SchedulePosition => ({
  item: { id: 'v1', durationSeconds: 300 },
  seekSeconds: 45,
  slotStartTime: new Date('2024-01-01T00:00:00Z'),
  slotEndTime: new Date('2024-01-01T00:05:00Z'),
})

function makeLayoutValue(overrides: Partial<ReturnType<typeof mockUseTvLayout>> = {}) {
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
    customChannels: [],
    addCustomChannel: vi.fn(),
    isFullscreen: false,
    toggleFullscreen: vi.fn(),
    toggleTheater: vi.fn(),
    isTheater: false,
    viewMode: 'normal',
    overlayMode: 'crt',
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
    activeIntensity: 'medium',
    setActiveIntensity: vi.fn(),
    channelFailed: () => false,
    refetchChannel: mockRefetchChannel,
    ...overrides,
  }
}

function renderChannelView(channelId = 'skate') {
  const routeObj = (
    channelViewModule as unknown as {
      Route: { useParams: () => { channelId: string } }
    }
  ).Route
  routeObj.useParams = () => ({ channelId })
  return render(<ChannelView />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChannelView', () => {
  beforeEach(() => {
    mockUseTvLayout.mockReturnValue(makeLayoutValue())
    mockUseChannelNavigation.mockReturnValue({
      nextChannel: vi.fn(),
      prevChannel: vi.fn(),
      goToChannel: vi.fn(),
      currentNumber: 1,
      totalChannels: 6,
    })
    mockUseKeyboardControls.mockImplementation(() => {})
    mockUseCurrentProgram.mockReturnValue(makePosition())
    mockTvPlayer.mockReturnValue(<div data-testid="tv-player" />)
    mockLoadCustomChannels.mockReturnValue([])
    mockCopyToClipboard.mockResolvedValue(true)
    mockMobileView.mockReturnValue(<div data-testid="mobile-view" />)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    it('shows loading text while layout Map is empty (channel not yet fetched)', () => {
      // Empty Map — layout fetch hasn't completed yet
      mockUseTvLayout.mockReturnValue(makeLayoutValue({ loadedChannels: new Map() }))

      renderChannelView('skate')

      expect(screen.getByText(/TUNING IN/i)).toBeDefined()
    })

    // After hydration the blurred loading poster is allowed to render. (The
    // pre-hydration *absence* that fixes the #74 mismatch can't be observed
    // through RTL, which auto-flushes the clientReady effect inside render's
    // act() wrapper — so the SSR-vs-client divergence is asserted at the pure
    // mechanism level in the "loading poster is time-derived" test below.)
    it('renders the blurred loading poster once loading (post-hydration)', () => {
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map() }),
      )

      const { container } = renderChannelView('skate')

      const poster = Array.from(
        container.querySelectorAll<HTMLElement>('[style]'),
      ).filter((el) => el.style.backgroundImage.includes('url('))
      expect(poster.length).toBeGreaterThan(0)
    })
  })

  describe('channel loading from layout Map', () => {
    it('renders TvPlayer when channel is in the layout Map', async () => {
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['skate', channel]]) }),
      )

      renderChannelView('skate')

      await waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())
      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.id).toBe('skate')
    })

    it('renders TvPlayer with correct channel for music channel', async () => {
      const channel: Channel = {
        kind: 'music',
        id: 'radio-soulwax',
        number: 11,
        name: 'Radio Soulwax',
        source: 'soundcloud',
        sourceUrl: 'https://soundcloud.com/test',
        totalDurationSeconds: 600,
        trackCount: 2,
        tracks: [
          { id: 't1', title: 'Track 1', artist: 'Artist', durationSeconds: 300, embedUrl: 'https://soundcloud.com/t1' },
          { id: 't2', title: 'Track 2', artist: 'Artist', durationSeconds: 300, embedUrl: 'https://soundcloud.com/t2' },
        ],
      }
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['radio-soulwax', channel]]) }),
      )

      renderChannelView('radio-soulwax')

      await waitFor(() => {
        // Music channels render MusicChannelView, not TvPlayer — just verify no NO SIGNAL
        expect(screen.queryByText('NO SIGNAL')).toBeNull()
      })
    })

    it('falls back to mock for unknown channel id (not in Map, not custom)', async () => {
      renderChannelView('unknown-channel')

      await waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())
      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.id).toBe('unknown-channel')
    })
  })

  describe('quota exhausted fallback', () => {
    it('renders TvPlayer with mock channel when quota is exhausted', async () => {
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ isQuotaExhausted: true }),
      )

      renderChannelView('skate')

      await waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())
      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.id).toBe('skate')
    })

    it('uses channel name from preset for mock channel', async () => {
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ isQuotaExhausted: true }),
      )

      renderChannelView('music')

      await waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())
      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.name).toBe('Music Videos')
    })

    it('falls back to generic name for unknown channel id', async () => {
      renderChannelView('unknown-channel')

      await waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())
      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.name).toBe('Channel')
    })
  })

  describe('keyboard controls wiring', () => {
    it('passes nextChannel and prevChannel to useKeyboardControls', async () => {
      const channel = makeChannel('skate')
      const nextChannel = vi.fn()
      const prevChannel = vi.fn()
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['skate', channel]]) }),
      )
      mockUseChannelNavigation.mockReturnValue({
        nextChannel,
        prevChannel,
        goToChannel: vi.fn(),
        currentNumber: 1,
        totalChannels: 12,
      })

      renderChannelView('skate')

      await waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

      const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
        onChannelUp: () => void
        onChannelDown: () => void
      }
      config.onChannelUp()
      config.onChannelDown()

      expect(prevChannel).toHaveBeenCalledOnce()
      expect(nextChannel).toHaveBeenCalledOnce()
    })

    it('passes toggleGuide from layout context to keyboard controls', async () => {
      const toggleGuide = vi.fn()
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          toggleGuide,
          loadedChannels: new Map([['skate', channel]]),
        }),
      )

      renderChannelView('skate')

      await waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

      const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
        onToggleGuide: () => void
      }
      config.onToggleGuide()
      expect(toggleGuide).toHaveBeenCalledOnce()
    })
  })

  describe('no signal state', () => {
    it('shows NO SIGNAL when position is null after loading completes', async () => {
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['skate', channel]]) }),
      )
      mockUseCurrentProgram.mockReturnValue(null)

      renderChannelView('skate')

      await waitFor(() => {
        expect(screen.getByText('NO SIGNAL')).toBeDefined()
      })
    })
  })

  describe('keyboard help', () => {
    // The help modal itself is rendered at the LAYOUT level (_tv.tsx), not
    // here — it must live outside <main>'s isolation: isolate stacking
    // context or a z-60 modal paints below the z-50 welcome overlay. So the
    // route's only responsibility is to relay onHelp -> layout toggleHelp.
    it('relays the onHelp keyboard control to the layout toggleHelp', async () => {
      const toggleHelp = vi.fn()
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          loadedChannels: new Map([['skate', channel]]),
          toggleHelp,
        }),
      )

      renderChannelView('skate')

      await waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

      const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
        onHelp: () => void
      }
      act(() => config.onHelp())

      expect(toggleHelp).toHaveBeenCalledTimes(1)
    })

    it('closes help on Escape when helpVisible is set', async () => {
      const closeHelp = vi.fn()
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          loadedChannels: new Map([['skate', channel]]),
          helpVisible: true,
          closeHelp,
        }),
      )

      renderChannelView('skate')

      await waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

      const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
        onEscape: () => void
      }
      act(() => config.onEscape())

      expect(closeHelp).toHaveBeenCalledTimes(1)
    })

    it('Escape closes help before welcome when both are open', async () => {
      // Help (MODAL z=60) sits above welcome (ONBOARDING z=50), so one Esc must
      // dismiss help and leave the welcome underneath — not the reverse.
      const closeHelp = vi.fn()
      const dismissDesktopOnboarding = vi.fn()
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          loadedChannels: new Map([['skate', channel]]),
          helpVisible: true,
          needsDesktopOnboarding: true,
          closeHelp,
          dismissDesktopOnboarding,
        }),
      )

      renderChannelView('skate')

      await waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

      const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
        onEscape: () => void
      }
      act(() => config.onEscape())

      expect(closeHelp).toHaveBeenCalledTimes(1)
      expect(dismissDesktopOnboarding).not.toHaveBeenCalled()
    })
  })

  describe('signal lost (failed music channel)', () => {
    it('renders SIGNAL LOST when the channel is marked failed', () => {
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          loadedChannels: new Map(),
          channelFailed: (id: string) => id === 'sc-calming',
        }),
      )
      renderChannelView('sc-calming')
      expect(screen.getByText('SIGNAL LOST')).toBeDefined()
    })

    it('calls refetchChannel and emits telemetry when retry is clicked', async () => {
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          loadedChannels: new Map(),
          channelFailed: (id: string) => id === 'sc-calming',
          refetchChannel: mockRefetchChannel,
        }),
      )
      renderChannelView('sc-calming')
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      expect(mockTrackRetry).toHaveBeenCalledWith('sc-calming', 1)
      expect(mockRefetchChannel).toHaveBeenCalledWith('sc-calming')
    })
  })
  describe('click-to-unmute prompt', () => {
    // Regression: the prompt must UNMUTE, never toggle. The layout's
    // first-gesture handler also clears isMuted on the same click, and
    // toggleMute is a non-functional setIsMuted(!isMuted) over captured
    // state — an unconditional flip here could race the player back to
    // muted with no remaining way to unmute (there is no [M] key anymore).
    const renderWithPrompt = (isMuted: boolean) => {
      const toggleMute = vi.fn()
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          loadedChannels: new Map([['skate', channel]]),
          isMuted,
          toggleMute,
        }),
      )
      mockTvPlayer.mockImplementation(
        (props: { onNeedsInteraction?: () => void }) => (
          <button
            data-testid="trigger-needs-interaction"
            onClick={() => props.onNeedsInteraction?.()}
          />
        ),
      )
      renderChannelView('skate')
      act(() => {
        fireEvent.click(screen.getByTestId('trigger-needs-interaction'))
      })
      return { toggleMute }
    }

    it('unmutes when the player is muted', () => {
      const { toggleMute } = renderWithPrompt(true)
      toggleMute.mockClear()
      fireEvent.click(screen.getByText('CLICK TO UNMUTE'))
      expect(toggleMute).toHaveBeenCalledTimes(1)
    })

    it('does not re-mute when isMuted already flipped false mid-gesture', () => {
      const { toggleMute } = renderWithPrompt(false)
      toggleMute.mockClear()
      fireEvent.click(screen.getByText('CLICK TO UNMUTE'))
      expect(toggleMute).not.toHaveBeenCalled()
    })

    it('dismisses the prompt after clicking', () => {
      renderWithPrompt(true)
      fireEvent.click(screen.getByText('CLICK TO UNMUTE'))
      expect(screen.queryByText('CLICK TO UNMUTE')).toBeNull()
    })
  })

  describe('custom and unknown channel resolution', () => {
    const makeCustomChannel = (id: string): Channel => ({
      kind: 'video',
      id,
      number: 900,
      name: `Custom ${id}`,
      playlistId: 'PLcustom',
      videos: [
        { id: 'cv1', title: 'Custom clip', durationSeconds: 200, thumbnailUrl: '' },
      ],
      totalDurationSeconds: 200,
    })

    it('loads a custom channel from storage and registers it with the layout', async () => {
      const custom = makeCustomChannel('my-list')
      mockLoadCustomChannels.mockReturnValue([custom])

      renderChannelView('my-list')

      await waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())
      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.id).toBe('my-list')
      expect(mockUseTvLayout.mock.calls[0]?.[0]).toBeUndefined() // context read is argument-free
      const layout = mockUseTvLayout.mock.results.at(-1)?.value as ReturnType<typeof makeLayoutValue>
      expect(layout.registerChannel).toHaveBeenCalledWith(custom)
    })

    it('falls back to the layout map for a custom channel missing from storage', async () => {
      const custom = makeCustomChannel('from-map')
      mockLoadCustomChannels.mockReturnValue([])
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['from-map', custom]]) }),
      )

      renderChannelView('from-map')

      await waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())
      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.id).toBe('from-map')
    })

    it('triggers a priority fetch once while a preset channel is unresolved', async () => {
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map() }),
      )

      const { rerender } = renderChannelView('skate')
      await waitFor(() =>
        expect(mockRefetchChannel).toHaveBeenCalledWith('skate'),
      )

      // A loadedChannels update re-runs the resolve effect; the per-visit
      // priority-fetch guard must not fire a second refetch.
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['skate', channel]]) }),
      )
      rerender(<ChannelView />)

      await waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())
      expect(mockRefetchChannel).toHaveBeenCalledTimes(1)
    })

    it('does not priority-fetch a channel that is marked terminally failed', async () => {
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          loadedChannels: new Map(),
          channelFailed: (id: string) => id === 'sc-calming',
        }),
      )

      renderChannelView('sc-calming')

      // The failed channel shows SIGNAL LOST; refetch is owned by the retry button
      expect(screen.getByText('SIGNAL LOST')).toBeTruthy()
      expect(mockRefetchChannel).not.toHaveBeenCalled()
    })
  })

  describe('music channel branches', () => {
    const makeMusicChannel = (): Channel => ({
      kind: 'music',
      id: 'sc-calming',
      number: 23,
      name: 'Calming',
      source: 'soundcloud',
      sourceUrl: 'https://soundcloud.com/krunz/sets/calming',
      totalDurationSeconds: 600,
      trackCount: 2,
      tracks: [
        { id: 't1', title: 'Track 1', artist: 'Artist', durationSeconds: 300, embedUrl: 'https://soundcloud.com/t1' },
        { id: 't2', title: 'Track 2', artist: 'Artist', durationSeconds: 300, embedUrl: 'https://soundcloud.com/t2' },
      ],
    })

    it('renders the music loading composition (no TvPlayer, no video TUNING screen)', () => {
      // Music preset with no resolved data: loading renders MusicChannelView
      // with position=null behind the tuning overlay.
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map() }),
      )

      const { container } = renderChannelView('sc-calming')

      expect(mockTvPlayer).not.toHaveBeenCalled()
      expect(screen.queryByText('TUNING IN...')).toBeNull()
      expect(container.querySelector('[data-testid="music-status-badge"]')).toBeNull()
    })

    it('renders the music invariant fallback when a music preset resolves to a video channel', async () => {
      const videoChannel = makeChannel('sc-calming')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          loadedChannels: new Map([['sc-calming', videoChannel]]),
        }),
      )

      renderChannelView('sc-calming')

      await waitFor(() =>
        expect(mockLogChannelLoadFailed).toHaveBeenCalledWith(
          'sc-calming',
          'invariant: music preset resolved to non-music channel',
        ),
      )
      expect(screen.getByText('NO SIGNAL')).toBeTruthy()
      expect(mockTvPlayer).not.toHaveBeenCalled()
    })

    it('renders MusicChannelView (not TvPlayer) once a music channel resolves', async () => {
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          loadedChannels: new Map([['sc-calming', makeMusicChannel()]]),
        }),
      )

      const { container } = renderChannelView('sc-calming')

      await waitFor(() =>
        expect(
          container.querySelector('[data-testid="music-status-badge"]'),
        ).not.toBeNull(),
      )
      expect(mockTvPlayer).not.toHaveBeenCalled()
    })
  })

  describe('mobile composition', () => {
    const makeInteractiveMobileView = () => {
      mockMobileView.mockImplementation(
        (props: {
          onChannelSelect: (id: string) => void
          onPlay: () => void
          onNextChannel: () => void
          onPrevChannel: () => void
        }) => (
          <div data-testid="mobile-view">
            <button data-testid="m-select" onClick={() => props.onChannelSelect('party')} />
            <button data-testid="m-play" onClick={props.onPlay} />
            <button data-testid="m-next" onClick={props.onNextChannel} />
            <button data-testid="m-prev" onClick={props.onPrevChannel} />
          </div>
        ),
      )
    }

    it('renders MobileView instead of TvPlayer on mobile for a video channel', async () => {
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          isMobile: true,
          loadedChannels: new Map([['skate', channel]]),
        }),
      )
      makeInteractiveMobileView()

      renderChannelView('skate')

      await waitFor(() => expect(mockMobileView).toHaveBeenCalled())
      expect(mockTvPlayer).not.toHaveBeenCalled()
      const callArgs = mockMobileView.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.id).toBe('skate')
    })

    it('mobile channel select navigates to the selected channel', async () => {
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          isMobile: true,
          loadedChannels: new Map([['skate', channel]]),
        }),
      )
      makeInteractiveMobileView()
      renderChannelView('skate')
      await waitFor(() => expect(mockMobileView).toHaveBeenCalled())

      fireEvent.click(screen.getByTestId('m-select'))

      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/channel/$channelId',
        params: { channelId: 'party' },
      })
    })

    it('mobile next/prev channel relays the keyboard-wrapped navigation', async () => {
      const nextChannel = vi.fn()
      const prevChannel = vi.fn()
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          isMobile: true,
          loadedChannels: new Map([['skate', channel]]),
        }),
      )
      mockUseChannelNavigation.mockReturnValue({
        nextChannel,
        prevChannel,
        goToChannel: vi.fn(),
        currentNumber: 1,
        totalChannels: 12,
      })
      makeInteractiveMobileView()
      renderChannelView('skate')
      await waitFor(() => expect(mockMobileView).toHaveBeenCalled())

      fireEvent.click(screen.getByTestId('m-next'))
      fireEvent.click(screen.getByTestId('m-prev'))

      expect(nextChannel).toHaveBeenCalledOnce()
      expect(prevChannel).toHaveBeenCalledOnce()
    })

    it('mobile first-play force-mutes an unmuted player and skips a muted one', async () => {
      // onPlay = () => { if (!isMuted) toggleMute() } — the first mobile tap
      // force-mutes (the YT iframe then satisfies autoplay policy), but a
      // player that is already muted must not be toggled again.
      const channel = makeChannel('skate')
      const toggleMute = vi.fn()
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          isMobile: true,
          isMuted: false,
          toggleMute,
          loadedChannels: new Map([['skate', channel]]),
        }),
      )
      makeInteractiveMobileView()
      const first = renderChannelView('skate')
      await waitFor(() => expect(mockMobileView).toHaveBeenCalled())

      fireEvent.click(screen.getByTestId('m-play'))
      expect(toggleMute).toHaveBeenCalledOnce()
      first.unmount()

      // Already muted: the same tap path is a no-op
      const toggleMuteMuted = vi.fn()
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          isMobile: true,
          isMuted: true,
          toggleMute: toggleMuteMuted,
          loadedChannels: new Map([['skate', channel]]),
        }),
      )
      renderChannelView('skate')
      await waitFor(() => expect(mockMobileView).toHaveBeenCalled())
      fireEvent.click(screen.getByTestId('m-play'))
      expect(toggleMuteMuted).not.toHaveBeenCalled()
    })
  })

  describe('resync (R key) static burst', () => {
    it('shows the static burst after resync and hides it 370ms later', async () => {
      vi.useFakeTimers()
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['skate', channel]]) }),
      )
      mockTvPlayer.mockImplementation(
        (props: { onResync?: () => void }) => (
          <button data-testid="trigger-resync" onClick={() => props.onResync?.()} />
        ),
      )
      try {
        renderChannelView('skate')
        await vi.waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())

        expect(document.querySelector('.static-burst')).toBeNull()
        fireEvent.click(screen.getByTestId('trigger-resync'))
        expect(document.querySelector('.static-burst')).not.toBeNull()

        act(() => {
          vi.advanceTimersByTime(370)
        })
        expect(document.querySelector('.static-burst')).toBeNull()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('overlay cycling toast (V key)', () => {
    it('cycles the overlay and shows the mode toast, then hides it after 1500ms', async () => {
      vi.useFakeTimers()
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['skate', channel]]) }),
      )
      try {
        renderChannelView('skate')
        await vi.waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

        const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
          onOverlay: () => void
        }
        act(() => {
          config.onOverlay()
        })
        expect(screen.getByText(/OVERLAY:/)).toBeTruthy()

        act(() => {
          vi.advanceTimersByTime(1500)
        })
        expect(screen.queryByText(/OVERLAY:/)).toBeNull()
      } finally {
        vi.useRealTimers()
      }
    })

    it('labels the OFF overlay mode explicitly in the toast', async () => {
      vi.useFakeTimers()
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          loadedChannels: new Map([['skate', channel]]),
          overlayMode: 'none',
        }),
      )
      try {
        renderChannelView('skate')
        await vi.waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

        const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
          onOverlay: () => void
        }
        act(() => {
          config.onOverlay()
        })
        expect(screen.getByText('OVERLAY: OFF')).toBeTruthy()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('share (C key)', () => {
    const getShareConfig = async () => {
      renderChannelView('skate')
      await waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())
      return mockUseKeyboardControls.mock.calls[0]?.[0] as {
        onShare: () => void
      }
    }

    it('copies the URL, shows a LINK COPIED toast, and emits telemetry', async () => {
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['skate', channel]]) }),
      )
      mockCopyToClipboard.mockResolvedValue(true)
      const config = await getShareConfig()

      act(() => {
        config.onShare()
      })

      expect(mockCopyToClipboard).toHaveBeenCalledWith(window.location.href)
      await waitFor(() =>
        expect(mockTrackShareChannel).toHaveBeenCalledWith('skate', true),
      )
      expect(screen.getByText('LINK COPIED')).toBeTruthy()
    })

    it('shows COPY FAILED when the clipboard write fails', async () => {
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['skate', channel]]) }),
      )
      mockCopyToClipboard.mockResolvedValue(false)
      const config = await getShareConfig()

      act(() => {
        config.onShare()
      })

      await waitFor(() => expect(screen.getByText('COPY FAILED')).toBeTruthy())
      expect(mockTrackShareChannel).toHaveBeenCalledWith('skate', false)
    })

    it('debounces rapid share presses to one clipboard write', async () => {
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['skate', channel]]) }),
      )
      const config = await getShareConfig()

      act(() => {
        config.onShare()
        config.onShare()
        config.onShare()
      })

      expect(mockCopyToClipboard).toHaveBeenCalledTimes(1)
    })
  })

  describe('keyboard wiring (remaining handlers)', () => {
    const getChannelSetup = () => {
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['skate', channel]]) }),
      )
    }

    it('Escape exits theater when help and onboarding are closed', async () => {
      getChannelSetup()
      const toggleTheater = vi.fn()
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          loadedChannels: new Map([['skate', makeChannel('skate')]]),
          isTheater: true,
          toggleTheater,
        }),
      )
      renderChannelView('skate')
      await waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

      const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
        onEscape: () => void
      }
      act(() => config.onEscape())

      expect(toggleTheater).toHaveBeenCalledOnce()
    })

    it('relays onHome to a router navigation to the splash screen', async () => {
      getChannelSetup()
      renderChannelView('skate')
      await waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

      const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
        onHome: () => void
      }
      act(() => config.onHome())

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
    })

    it('relays onImport, onFullscreen, and onTheater to the layout context', async () => {
      const toggleImport = vi.fn()
      const toggleFullscreen = vi.fn()
      const toggleTheater = vi.fn()
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          loadedChannels: new Map([['skate', makeChannel('skate')]]),
          toggleImport,
          toggleFullscreen,
          toggleTheater,
        }),
      )
      renderChannelView('skate')
      await waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

      const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
        onImport: () => void
        onFullscreen: () => void
        onTheater: () => void
      }
      act(() => {
        config.onImport()
        config.onFullscreen()
        config.onTheater()
      })

      expect(toggleImport).toHaveBeenCalledOnce()
      expect(toggleFullscreen).toHaveBeenCalledOnce()
      expect(toggleTheater).toHaveBeenCalledOnce()
    })

    it('passes through onKeyMatched to the keyboard-shortcut tracker', async () => {
      getChannelSetup()
      renderChannelView('skate')
      await waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

      const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
        onKeyMatched: (key: string) => void
      }
      act(() => config.onKeyMatched('g'))

      expect(mockTrackKeyboardShortcut).toHaveBeenCalledWith('g')
    })
  })

  describe('visualizer cycling (music channels only)', () => {
    it('cycles the visualizer preset for a loaded music channel', async () => {
      const musicChannel: Channel = {
        kind: 'music',
        id: 'sc-calming',
        number: 23,
        name: 'Calming',
        source: 'soundcloud',
        sourceUrl: 'https://soundcloud.com/krunz/sets/calming',
        totalDurationSeconds: 600,
        trackCount: 1,
        tracks: [
          { id: 't1', title: 'Track 1', artist: 'Artist', durationSeconds: 600, embedUrl: 'https://soundcloud.com/t1' },
        ],
      }
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          loadedChannels: new Map([['sc-calming', musicChannel]]),
        }),
      )
      renderChannelView('sc-calming')
      await waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

      const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
        onVisualizerCycle: () => void
        onIntensityCycle: () => void
      }
      act(() => {
        config.onVisualizerCycle()
        config.onIntensityCycle()
      })

      const layout = mockUseTvLayout.mock.results.at(-1)?.value as ReturnType<typeof makeLayoutValue>
      expect(layout.setActivePreset).toHaveBeenCalledWith(
        expect.not.stringMatching('spectrum'),
      )
      expect(layout.setActiveIntensity).toHaveBeenCalledOnce()
    })

    it('visualizer and intensity cycling are no-ops for a video channel', async () => {
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          loadedChannels: new Map([['skate', makeChannel('skate')]]),
        }),
      )
      renderChannelView('skate')
      await waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

      const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
        onVisualizerCycle: () => void
        onIntensityCycle: () => void
      }
      act(() => {
        config.onVisualizerCycle()
        config.onIntensityCycle()
      })

      const layout = mockUseTvLayout.mock.results.at(-1)?.value as ReturnType<typeof makeLayoutValue>
      expect(layout.setActivePreset).not.toHaveBeenCalled()
      expect(layout.setActiveIntensity).not.toHaveBeenCalled()
    })
  })

  describe('channel switch telemetry and misc desktop chrome', () => {
    it('emits channel_switch RUM telemetry on mount and on channel change', async () => {
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['skate', channel]]) }),
      )
      const routeObj = (
        channelViewModule as unknown as {
          Route: { useParams: () => { channelId: string } }
        }
      ).Route
      const { rerender } = renderChannelView('skate')
      await waitFor(() =>
        expect(mockTrackChannelSwitch).toHaveBeenCalledWith(
          'none',
          'skate',
          0,
          1,
        ),
      )

      // Switching channels re-fires telemetry with the previous channel as `from`
      mockTrackChannelSwitch.mockClear()
      routeObj.useParams = () => ({ channelId: 'music' })
      rerender(<ChannelView />)
      await waitFor(() =>
        expect(mockTrackChannelSwitch).toHaveBeenCalledWith(
          'skate',
          'music',
          1,
          2,
        ),
      )
    })

    it('shows the MUTED badge while the player is muted without a pending prompt', async () => {
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({
          isMuted: true,
          loadedChannels: new Map([['skate', channel]]),
        }),
      )

      renderChannelView('skate')

      await waitFor(() => expect(screen.getByText('MUTED')).toBeTruthy())
    })
  })
})
