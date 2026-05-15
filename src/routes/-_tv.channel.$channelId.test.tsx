import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import { ChannelView } from './_tv.channel.$channelId'

// ---------------------------------------------------------------------------
// Setup Route.useParams mock
// We re-export ChannelView and mock Route at module level, but we need to
// intercept Route.useParams. We do this by patching the module after import.
// ---------------------------------------------------------------------------

import * as channelViewModule from './_tv.channel.$channelId'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockBuildChannel,
  mockUseCurrentProgram,
  mockUseChannelNavigation,
  mockUseKeyboardControls,
  mockUseTvLayout,
  mockTvPlayer,
  mockKeyboardHelp,
  mockUseParams,
} = vi.hoisted(() => ({
  mockBuildChannel: vi.fn(),
  mockUseCurrentProgram: vi.fn(),
  mockUseChannelNavigation: vi.fn(),
  mockUseKeyboardControls: vi.fn(),
  mockUseTvLayout: vi.fn(),
  mockTvPlayer: vi.fn(),
  mockKeyboardHelp: vi.fn(),
  mockUseParams: vi.fn(),
}))

vi.mock('~/lib/channels/youtube-api', () => ({
  buildChannel: mockBuildChannel,
  YouTubeQuotaError: class YouTubeQuotaError extends Error {},
}))

vi.mock('~/lib/storage/preset-channel-cache', () => ({
  loadCachedChannel: vi.fn(() => null),
  saveCachedChannel: vi.fn(),
  clearPresetChannelCache: vi.fn(),
}))

vi.mock('~/lib/storage/local-channels', () => ({
  loadCustomChannels: vi.fn(() => []),
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

vi.mock('~/contexts/surf-mode-context', () => ({
  useSurfModeContext: () => ({
    isSurfing: false,
    countdown: 0,
    dwellSeconds: 15,
    startSurf: vi.fn(),
    stopSurf: vi.fn(),
    setDwellSeconds: vi.fn(),
  }),
}))

vi.mock('~/components/tv-player', () => ({
  TvPlayer: mockTvPlayer,
}))

vi.mock('~/components/keyboard-help', () => ({
  KeyboardHelp: mockKeyboardHelp,
}))

vi.mock('~/lib/sources/soundcloud/sc-widget-context', () => ({
  useScWidget: () => ({
    widget: null,
    status: 'mounting',
    currentUrl: null,
    activeChannelId: null,
    isReady: false,
    setActiveChannel: vi.fn(),
  }),
}))

// Mock TanStack Router — avoid importOriginal to prevent circular module resolution
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (opts: unknown) => opts,
  useNavigate: () => vi.fn(),
}))

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

function renderChannelView(channelId = 'skate') {
  // Patch the exported Route object's useParams before each render
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
    mockUseTvLayout.mockReturnValue({
      guideVisible: true,
      toggleGuide: vi.fn(),
      importVisible: false,
      toggleImport: vi.fn(),
      currentChannelId: null,
      setCurrentChannelId: vi.fn(),
      loadedChannels: new Map(),
      registerChannel: vi.fn(),
      customChannels: [],
      addCustomChannel: vi.fn(),
      isFullscreen: false,
      toggleFullscreen: vi.fn(),
      viewMode: 'normal',
      overlayMode: 'crt',
      cycleOverlay: vi.fn(),
      isMuted: false,
      toggleMute: vi.fn(),
      isMobile: false,
      isQuotaExhausted: false,
      setQuotaExhausted: vi.fn(),
      clearQuotaExhausted: vi.fn(),
      navigationSource: 'direct',
      setNavigationSource: vi.fn(),
      showHelp: false,
      setShowHelp: vi.fn(),
    })
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
    mockKeyboardHelp.mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    it('shows loading text while channel is loading', () => {
      // buildChannel never resolves in this test
      mockBuildChannel.mockReturnValue(new Promise(() => {}))

      renderChannelView('skate')

      expect(screen.getByText(/TUNING IN/i)).toBeDefined()
    })
  })

  describe('mock channel fallback (quota exhausted)', () => {
    it('renders TvPlayer with mock channel when quota is exhausted', async () => {
      mockBuildChannel.mockRejectedValue(new Error('quota'))
      renderChannelView('skate')

      await waitFor(() => {
        expect(mockTvPlayer).toHaveBeenCalled()
      })

      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.id).toBe('skate')
    })

    it('uses channel name from preset for mock channel', async () => {
      mockBuildChannel.mockRejectedValue(new Error('quota'))
      renderChannelView('music')

      await waitFor(() => {
        expect(mockTvPlayer).toHaveBeenCalled()
      })

      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.name).toBe('Music Videos')
    })

    it('falls back to generic name for unknown channel id', async () => {
      renderChannelView('unknown-channel')

      await waitFor(() => {
        expect(mockTvPlayer).toHaveBeenCalled()
      })

      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.name).toBe('Channel')
    })
  })

  describe('channel loading', () => {
    it('calls buildChannel with the preset', async () => {
      const channel = makeChannel('skate')
      mockBuildChannel.mockResolvedValue(channel)

      renderChannelView('skate')

      await waitFor(() => {
        expect(mockBuildChannel).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'skate' }),
        )
      })
    })

    it('renders TvPlayer after buildChannel resolves', async () => {
      mockBuildChannel.mockResolvedValue(makeChannel('skate'))

      renderChannelView('skate')

      await waitFor(() => {
        expect(mockTvPlayer).toHaveBeenCalled()
      })

      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.id).toBe('skate')
    })

    it('falls back to mock channel when buildChannel rejects', async () => {
      mockBuildChannel.mockRejectedValue(new Error('API quota exceeded'))

      renderChannelView('skate')

      await waitFor(() => {
        expect(mockTvPlayer).toHaveBeenCalled()
      })

      // Mock channel fallback: 3 placeholder videos
      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(
        callArgs.channel.kind === 'video' && callArgs.channel.videos.length,
      ).toBe(3)
    })

    it('registers the fetched channel into the layout map after buildChannel resolves', async () => {
      // Regression: without this, music channels stay as the empty-tracks
      // stub on first visit because `loadedChannel = cachedChannel ?? fetchedChannel`
      // resolves to the stub from the layout map, and `fetchedChannel` is
      // ignored until a page reload re-hydrates tracks from IndexedDB.
      const registerChannel = vi.fn()
      mockUseTvLayout.mockReturnValue({
        guideVisible: true,
        toggleGuide: vi.fn(),
        importVisible: false,
        toggleImport: vi.fn(),
        currentChannelId: null,
        setCurrentChannelId: vi.fn(),
        loadedChannels: new Map(),
        registerChannel,
        customChannels: [],
        addCustomChannel: vi.fn(),
        isFullscreen: false,
        toggleFullscreen: vi.fn(),
        viewMode: 'normal',
        overlayMode: 'crt',
        cycleOverlay: vi.fn(),
        isMuted: false,
        toggleMute: vi.fn(),
        isMobile: false,
        isQuotaExhausted: false,
        setQuotaExhausted: vi.fn(),
        clearQuotaExhausted: vi.fn(),
        navigationSource: 'direct',
        setNavigationSource: vi.fn(),
        showHelp: false,
        setShowHelp: vi.fn(),
      })

      const channel = makeChannel('skate')
      mockBuildChannel.mockResolvedValue(channel)

      renderChannelView('skate')

      await waitFor(() => {
        expect(registerChannel).toHaveBeenCalledWith(channel)
      })
    })
  })

  describe('keyboard controls wiring', () => {
    it('passes nextChannel and prevChannel to useKeyboardControls', async () => {
      const nextChannel = vi.fn()
      const prevChannel = vi.fn()
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
      mockUseTvLayout.mockReturnValue({
        guideVisible: true,
        toggleGuide,
        importVisible: false,
        toggleImport: vi.fn(),
        currentChannelId: null,
        setCurrentChannelId: vi.fn(),
        loadedChannels: new Map(),
        registerChannel: vi.fn(),
        customChannels: [],
        addCustomChannel: vi.fn(),
        isFullscreen: false,
        toggleFullscreen: vi.fn(),
        toggleTheater: vi.fn(),
        viewMode: 'normal',
        overlayMode: 'crt',
        cycleOverlay: vi.fn(),
        currentPosition: null,
        setCurrentPosition: vi.fn(),
        isMuted: false,
        toggleMute: vi.fn(),
        navigationSource: 'direct',
        setNavigationSource: vi.fn(),
        showHelp: false,
        setShowHelp: vi.fn(),
      })

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
      mockUseCurrentProgram.mockReturnValue(null)

      renderChannelView('skate')

      await waitFor(() => {
        expect(screen.getByText('NO SIGNAL')).toBeDefined()
      })
    })
  })

  describe('KeyboardHelp modal', () => {
    it('renders KeyboardHelp with visible=false initially', async () => {
      renderChannelView('skate')

      await waitFor(() => expect(mockKeyboardHelp).toHaveBeenCalled())

      const lastCall = mockKeyboardHelp.mock.calls.at(-1)?.[0] as {
        visible: boolean
      }
      expect(lastCall.visible).toBe(false)
    })

    it('opens KeyboardHelp when onHelp keyboard control fires', async () => {
      mockKeyboardHelp.mockImplementation(
        ({ visible }: { visible: boolean }) =>
          visible ? <div data-testid="keyboard-help-modal" /> : null,
      )

      renderChannelView('skate')

      await waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

      const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
        onHelp: () => void
      }

      act(() => config.onHelp())

      await waitFor(() => {
        expect(screen.getByTestId('keyboard-help-modal')).toBeDefined()
      })
    })
  })
})
