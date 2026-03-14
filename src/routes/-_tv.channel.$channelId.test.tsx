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

vi.mock('~/components/keyboard-help', () => ({
  KeyboardHelp: mockKeyboardHelp,
}))

// Mock TanStack Router's useParams via the Route object
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute:
      (_path: string) => (opts: { component: React.ComponentType }) =>
        opts,
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeChannel = (id = 'nature'): Channel => ({
  id,
  number: 1,
  name: 'Nature & Wildlife',
  playlistId: 'PL123',
  videos: [
    { id: 'v1', title: 'Bears', durationSeconds: 300, thumbnailUrl: '' },
  ],
  totalDurationSeconds: 300,
})

const makePosition = (): SchedulePosition => ({
  video: { id: 'v1', title: 'Bears', durationSeconds: 300, thumbnailUrl: '' },
  seekSeconds: 45,
  slotStartTime: new Date('2024-01-01T00:00:00Z'),
  slotEndTime: new Date('2024-01-01T00:05:00Z'),
})

function renderChannelView(channelId = 'nature') {
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
    })
    mockUseChannelNavigation.mockReturnValue({
      nextChannel: vi.fn(),
      prevChannel: vi.fn(),
      goToChannel: vi.fn(),
      currentNumber: 1,
      totalChannels: 12,
    })
    mockUseKeyboardControls.mockImplementation(() => {})
    mockUseCurrentProgram.mockReturnValue(makePosition())
    mockTvPlayer.mockReturnValue(<div data-testid="tv-player" />)
    mockKeyboardHelp.mockReturnValue(null)
    // No API key by default
    ;(import.meta.env as Record<string, string>).VITE_YOUTUBE_API_KEY = ''
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    it('shows loading text while channel is loading', () => {
      // buildChannel never resolves in this test
      mockBuildChannel.mockReturnValue(new Promise(() => {}))
      ;(import.meta.env as Record<string, string>).VITE_YOUTUBE_API_KEY =
        'test-key'

      renderChannelView('nature')

      expect(screen.getByText(/TUNING IN/i)).toBeDefined()
    })
  })

  describe('mock channel fallback (no API key)', () => {
    it('renders TvPlayer with mock channel when no API key is set', async () => {
      renderChannelView('nature')

      await waitFor(() => {
        expect(mockTvPlayer).toHaveBeenCalled()
      })

      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.id).toBe('nature')
      // Mock channel has 3 videos
      expect(callArgs.channel.videos.length).toBe(3)
    })

    it('uses channel name from preset for mock channel', async () => {
      renderChannelView('space')

      await waitFor(() => {
        expect(mockTvPlayer).toHaveBeenCalled()
      })

      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.name).toBe('Space & NASA')
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

  describe('API key present', () => {
    it('calls buildChannel with the preset and API key', async () => {
      ;(import.meta.env as Record<string, string>).VITE_YOUTUBE_API_KEY =
        'yt-key-123'
      const channel = makeChannel('nature')
      mockBuildChannel.mockResolvedValue(channel)

      renderChannelView('nature')

      await waitFor(() => {
        expect(mockBuildChannel).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'nature' }),
          'yt-key-123',
        )
      })
    })

    it('renders TvPlayer after buildChannel resolves', async () => {
      ;(import.meta.env as Record<string, string>).VITE_YOUTUBE_API_KEY =
        'yt-key-123'
      mockBuildChannel.mockResolvedValue(makeChannel('nature'))

      renderChannelView('nature')

      await waitFor(() => {
        expect(mockTvPlayer).toHaveBeenCalled()
      })

      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.id).toBe('nature')
    })

    it('falls back to mock channel when buildChannel rejects', async () => {
      ;(import.meta.env as Record<string, string>).VITE_YOUTUBE_API_KEY =
        'yt-key-123'
      mockBuildChannel.mockRejectedValue(new Error('API quota exceeded'))

      renderChannelView('nature')

      await waitFor(() => {
        expect(mockTvPlayer).toHaveBeenCalled()
      })

      // Mock channel fallback: 3 placeholder videos
      const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: Channel }
      expect(callArgs.channel.videos.length).toBe(3)
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

      renderChannelView('nature')

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
      })

      renderChannelView('nature')

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

      renderChannelView('nature')

      await waitFor(() => {
        expect(screen.getByText('NO SIGNAL')).toBeDefined()
      })
    })
  })

  describe('KeyboardHelp modal', () => {
    it('renders KeyboardHelp with visible=false initially', async () => {
      renderChannelView('nature')

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

      renderChannelView('nature')

      await waitFor(() => expect(mockUseKeyboardControls).toHaveBeenCalled())

      const config = mockUseKeyboardControls.mock.calls[0]?.[0] as {
        onHelp: () => void
      }

      act(() => config.onHelp())

      expect(screen.getByTestId('keyboard-help-modal')).toBeDefined()
    })
  })
})
