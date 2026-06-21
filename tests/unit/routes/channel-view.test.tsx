import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'

import * as ChannelModule from '../../../src/routes/_tv.channel.$channelId.tsx'
import { ChannelView } from '../../../src/routes/_tv.channel.$channelId.tsx'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'

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
vi.mock('~/routes/_tv', () => ({ useTvLayout: mockUseTvLayout }))
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
vi.mock('~/components/tv-player', () => ({ TvPlayer: mockTvPlayer }))
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
vi.mock('~/lib/storage/local-channels', () => ({
  loadCustomChannels: vi.fn(() => []),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: (_path: string) => (opts: unknown) => opts,
    useNavigate: () => vi.fn(),
  }
})

const routeAny = ChannelModule.Route as unknown as {
  useParams: () => { channelId: string }
}

let mockChannelId = 'nature'
routeAny.useParams = () => ({ channelId: mockChannelId })

const makeChannel = (id: string): Channel => ({
  kind: 'video',
  id,
  number: 1,
  name: id.charAt(0).toUpperCase() + id.slice(1),
  playlistId: 'PL123',
  videos: [{ id: 'v1', title: 'Clip', durationSeconds: 300, thumbnailUrl: '' }],
  totalDurationSeconds: 300,
})

const makePosition = (): SchedulePosition => ({
  item: { id: 'v1', durationSeconds: 300 },
  seekSeconds: 0,
  slotStartTime: new Date('2024-01-01T00:00:00Z'),
  slotEndTime: new Date('2024-01-01T00:05:00Z'),
})

function makeLayoutValue(loadedChannels: Map<string, Channel> = new Map(), overrides = {}) {
  return {
    guideVisible: true,
    toggleGuide: vi.fn(),
    importVisible: false,
    toggleImport: vi.fn(),
    currentChannelId: null,
    setCurrentChannelId: vi.fn(),
    loadedChannels,
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
    currentPosition: null,
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

describe('ChannelView', () => {
  beforeEach(() => {
    mockChannelId = 'nature'
    mockUseTvLayout.mockReturnValue(makeLayoutValue())
    mockUseChannelNavigation.mockReturnValue({
      nextChannel: vi.fn(),
      prevChannel: vi.fn(),
      goToChannel: vi.fn(),
      currentNumber: 1,
      totalChannels: 12,
    })
    mockUseKeyboardControls.mockImplementation(() => {})
    mockUseCurrentProgram.mockReturnValue(makePosition())
    mockTvPlayer.mockReturnValue(
      React.createElement('div', { 'data-testid': 'tv-player' }),
    )
    mockKeyboardHelp.mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('displays loading state for nature channel (id from params) when Map is empty', async () => {
    mockChannelId = 'nature'
    // Empty Map — layout fetch not yet done
    mockUseTvLayout.mockReturnValue(makeLayoutValue(new Map()))
    render(React.createElement(ChannelView))
    await waitFor(() => {
      const hasPlayer = mockTvPlayer.mock.calls.length > 0
      const hasLoading = String(document.body.textContent).includes('TUNING IN')
      expect(hasPlayer || hasLoading).toBe(true)
    })
  })

  it('renders TvPlayer for channel nature when in layout Map', async () => {
    mockChannelId = 'nature'
    mockUseTvLayout.mockReturnValue(
      makeLayoutValue(new Map([['nature', makeChannel('nature')]])),
    )
    render(React.createElement(ChannelView))
    await waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())
    const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: { id: string } }
    expect(callArgs.channel.id).toBe('nature')
  })

  it('renders TvPlayer for channel jazz (id 4)', async () => {
    mockChannelId = 'jazz'
    mockUseTvLayout.mockReturnValue(
      makeLayoutValue(new Map([['jazz', makeChannel('jazz')]])),
    )
    render(React.createElement(ChannelView))
    await waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())
    const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: { id: string } }
    expect(callArgs.channel.id).toBe('jazz')
  })

  it('renders TvPlayer for channel classical (id 12, last channel)', async () => {
    mockChannelId = 'classical'
    mockUseTvLayout.mockReturnValue(
      makeLayoutValue(new Map([['classical', makeChannel('classical')]])),
    )
    render(React.createElement(ChannelView))
    await waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())
    const callArgs = mockTvPlayer.mock.calls[0]?.[0] as { channel: { id: string } }
    expect(callArgs.channel.id).toBe('classical')
  })

  it('shows TUNING IN text while layout Map has no entry for this channel', () => {
    mockChannelId = 'skate'
    // Map exists but doesn't have 'skate' — simulates layout fetch in progress
    mockUseTvLayout.mockReturnValue(makeLayoutValue(new Map()))
    render(React.createElement(ChannelView))
    expect(screen.getByText(/TUNING IN/i)).toBeTruthy()
  })

  it('shows the TUNING overlay (not the plain loading text) while a MUSIC channel loads', () => {
    // Regression guard: TuningOverlay must render at the ROUTE level during the
    // loading branch. It previously lived only in MusicChannelView, which mounts
    // *after* isLoading clears — so the overlay was never visible during a cold
    // music-channel load. 'sc-calming' is a real music preset (kind: 'music').
    mockChannelId = 'sc-calming'
    // Empty Map → still loading; widget mock reports not-yet-active + mounting,
    // so tuningPhase yields the "RESOLVING SIGNAL…" static state.
    mockUseTvLayout.mockReturnValue(makeLayoutValue(new Map()))
    render(React.createElement(ChannelView))
    expect(screen.getByTestId('tuning-overlay')).toBeTruthy()
    expect(screen.getByText(/RESOLVING SIGNAL/i)).toBeTruthy()
    // The plain video-style "TUNING IN..." loading text must NOT be shown for music.
    expect(screen.queryByText(/TUNING IN/i)).toBeNull()
  })
})
