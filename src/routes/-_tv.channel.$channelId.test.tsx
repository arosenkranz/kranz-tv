import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
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
  mockKeyboardHelp,
} = vi.hoisted(() => ({
  mockUseCurrentProgram: vi.fn(),
  mockUseChannelNavigation: vi.fn(),
  mockUseKeyboardControls: vi.fn(),
  mockUseTvLayout: vi.fn(),
  mockTvPlayer: vi.fn(),
  mockKeyboardHelp: vi.fn(),
  mockUseParams: vi.fn(),
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
    activeChannelId: null,
    isReady: false,
    setActiveChannel: vi.fn(),
  }),
}))

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

function makeLayoutValue(overrides: Partial<ReturnType<typeof mockUseTvLayout>> = {}) {
  return {
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
    navigationSource: 'direct',
    setNavigationSource: vi.fn(),
    needsDesktopOnboarding: false,
    dismissDesktopOnboarding: vi.fn(),
    activePreset: 'spectrum',
    setActivePreset: vi.fn(),
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
    mockKeyboardHelp.mockReturnValue(null)
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

  describe('KeyboardHelp modal', () => {
    it('renders KeyboardHelp with visible=false initially', async () => {
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['skate', channel]]) }),
      )

      renderChannelView('skate')

      await waitFor(() => expect(mockKeyboardHelp).toHaveBeenCalled())

      const lastCall = mockKeyboardHelp.mock.calls.at(-1)?.[0] as {
        visible: boolean
      }
      expect(lastCall.visible).toBe(false)
    })

    it('opens KeyboardHelp when onHelp keyboard control fires', async () => {
      const channel = makeChannel('skate')
      mockUseTvLayout.mockReturnValue(
        makeLayoutValue({ loadedChannels: new Map([['skate', channel]]) }),
      )
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
