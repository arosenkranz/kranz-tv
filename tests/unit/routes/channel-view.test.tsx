import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'

import * as ChannelModule from '../../../src/routes/_tv.channel.$channelId.tsx'
import { ChannelView } from '../../../src/routes/_tv.channel.$channelId.tsx'
import type { SchedulePosition } from '~/lib/scheduling/types'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any module imports that use them
// ---------------------------------------------------------------------------

const {
  mockBuildChannel,
  mockUseCurrentProgram,
  mockUseChannelNavigation,
  mockUseKeyboardControls,
  mockUseTvLayout,
  mockTvPlayer,
  mockKeyboardHelp,
} = vi.hoisted(() => ({
  mockBuildChannel: vi.fn(),
  mockUseCurrentProgram: vi.fn(),
  mockUseChannelNavigation: vi.fn(),
  mockUseKeyboardControls: vi.fn(),
  mockUseTvLayout: vi.fn(),
  mockTvPlayer: vi.fn(),
  mockKeyboardHelp: vi.fn(),
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
vi.mock('~/routes/_tv', () => ({ useTvLayout: mockUseTvLayout }))
vi.mock('~/components/tv-player', () => ({ TvPlayer: mockTvPlayer }))
vi.mock('~/components/keyboard-help', () => ({
  KeyboardHelp: mockKeyboardHelp,
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

const makePosition = (): SchedulePosition => ({
  video: { id: 'v1', title: 'Bears', durationSeconds: 300, thumbnailUrl: '' },
  seekSeconds: 0,
  slotStartTime: new Date('2024-01-01T00:00:00Z'),
  slotEndTime: new Date('2024-01-01T00:05:00Z'),
})

describe('ChannelView', () => {
  beforeEach(() => {
    mockChannelId = 'nature'
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
      toggleTheater: vi.fn(),
      viewMode: 'normal',
      overlayMode: 'crt',
      cycleOverlay: vi.fn(),
      currentPosition: null,
      setCurrentPosition: vi.fn(),
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
    mockTvPlayer.mockReturnValue(
      React.createElement('div', { 'data-testid': 'tv-player' }),
    )
    mockKeyboardHelp.mockReturnValue(null)
    ;(import.meta.env as Record<string, string>).VITE_YOUTUBE_API_KEY = ''
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('displays loading state for nature channel (id from params)', async () => {
    mockChannelId = 'nature'
    render(React.createElement(ChannelView))
    // With no API key, it immediately loads the mock channel — so either loading or player
    await waitFor(() => {
      const hasPlayer = mockTvPlayer.mock.calls.length > 0
      const hasLoading = String(document.body.textContent).includes('TUNING IN')
      expect(hasPlayer || hasLoading).toBe(true)
    })
  })

  it('renders TvPlayer for channel nature', async () => {
    mockChannelId = 'nature'
    render(React.createElement(ChannelView))
    await waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())
    const callArgs = mockTvPlayer.mock.calls[0]?.[0] as {
      channel: { id: string }
    }
    expect(callArgs.channel.id).toBe('nature')
  })

  it('renders TvPlayer for channel jazz (id 4)', async () => {
    mockChannelId = 'jazz'
    render(React.createElement(ChannelView))
    await waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())
    const callArgs = mockTvPlayer.mock.calls[0]?.[0] as {
      channel: { id: string }
    }
    expect(callArgs.channel.id).toBe('jazz')
  })

  it('renders TvPlayer for channel classical (id 12, last channel)', async () => {
    mockChannelId = 'classical'
    render(React.createElement(ChannelView))
    await waitFor(() => expect(mockTvPlayer).toHaveBeenCalled())
    const callArgs = mockTvPlayer.mock.calls[0]?.[0] as {
      channel: { id: string }
    }
    expect(callArgs.channel.id).toBe('classical')
  })

  it('shows TUNING IN text while API channel loads', () => {
    ;(import.meta.env as Record<string, string>).VITE_YOUTUBE_API_KEY =
      'test-key'
    mockBuildChannel.mockReturnValue(new Promise(() => {}))
    mockChannelId = 'skate'
    render(React.createElement(ChannelView))
    expect(screen.getByText(/TUNING IN/i)).toBeTruthy()
  })
})
