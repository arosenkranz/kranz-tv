import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'

import { TvPlayer } from './tv-player'

const {
  mockLoadYouTubeAPI,
  mockCreatePlayer,
  mockLoadVideo,
  mockGetSchedulePosition,
} = vi.hoisted(() => ({
  mockLoadYouTubeAPI: vi.fn(),
  mockCreatePlayer: vi.fn(),
  mockLoadVideo: vi.fn(),
  mockGetSchedulePosition: vi.fn(),
}))

vi.mock('~/lib/player/youtube-iframe', () => ({
  loadYouTubeAPI: mockLoadYouTubeAPI,
  createPlayer: mockCreatePlayer,
  loadVideo: mockLoadVideo,
}))

vi.mock('~/lib/scheduling/algorithm', () => ({
  getSchedulePosition: mockGetSchedulePosition,
}))

const makeChannel = (): Channel => ({
  id: 'nature',
  number: 1,
  name: 'Nature',
  playlistId: 'PL123',
  videos: [
    {
      id: 'v1',
      title: 'Bears',
      durationSeconds: 300,
      thumbnailUrl: 'https://img/bears.jpg',
    },
    {
      id: 'v2',
      title: 'Whales',
      durationSeconds: 400,
      thumbnailUrl: 'https://img/whales.jpg',
    },
  ],
  totalDurationSeconds: 700,
})

const makePosition = (videoId = 'v1', seekSeconds = 0): SchedulePosition => ({
  video: {
    id: videoId,
    title: 'Bears',
    durationSeconds: 300,
    thumbnailUrl: 'https://img/bears.jpg',
  },
  seekSeconds,
  slotStartTime: new Date('2024-01-01T00:00:00Z'),
  slotEndTime: new Date('2024-01-01T00:05:00Z'),
})

describe('TvPlayer', () => {
  let mockPlayerInstance: Partial<YT.Player>

  beforeEach(() => {
    mockPlayerInstance = {
      destroy: vi.fn(),
      loadVideoById: vi.fn(),
    }

    mockLoadYouTubeAPI.mockResolvedValue(undefined)
    mockCreatePlayer.mockResolvedValue(mockPlayerInstance)
    mockGetSchedulePosition.mockReturnValue(makePosition('v2', 5))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the youtube-player container div', () => {
    const channel = makeChannel()
    const position = makePosition()
    render(<TvPlayer channel={channel} position={position} isMuted={false} />)
    expect(document.getElementById('youtube-player')).not.toBeNull()
  })

  it('renders with w-full aspect-video bg-black wrapper', () => {
    const channel = makeChannel()
    const position = makePosition()
    const { container } = render(
      <TvPlayer channel={channel} position={position} isMuted={false} />,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('w-full')
    expect(wrapper.className).toContain('aspect-video')
    expect(wrapper.className).toContain('bg-black')
  })

  it('calls loadYouTubeAPI and createPlayer on mount', async () => {
    const channel = makeChannel()
    const position = makePosition('v1', 42)

    render(<TvPlayer channel={channel} position={position} isMuted={false} />)

    // Let the promises flush
    await vi.waitFor(() => {
      expect(mockLoadYouTubeAPI).toHaveBeenCalledOnce()
    })

    expect(mockCreatePlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        containerId: 'youtube-player',
        videoId: 'v1',
        startSeconds: 42,
      }),
    )
  })

  it('destroys the player on unmount', async () => {
    const channel = makeChannel()
    const position = makePosition()

    // Simulate onReady being called so playerRef gets set
    mockCreatePlayer.mockImplementation(
      async (params: { onReady?: (p: YT.Player) => void }) => {
        params.onReady?.(mockPlayerInstance)
        return mockPlayerInstance
      },
    )

    const { unmount } = render(
      <TvPlayer channel={channel} position={position} isMuted={false} />,
    )

    await vi.waitFor(() => expect(mockCreatePlayer).toHaveBeenCalled())

    unmount()

    expect(mockPlayerInstance.destroy).toHaveBeenCalledOnce()
  })

  it('loads the next video when the ENDED state fires', async () => {
    const channel = makeChannel()
    const position = makePosition('v1', 0)
    const nextPosition = makePosition('v2', 5)
    mockGetSchedulePosition.mockReturnValue(nextPosition)

    let capturedStateChange:
      | ((event: YT.OnStateChangeEvent) => void)
      | undefined

    mockCreatePlayer.mockImplementation(
      async (params: {
        onReady?: (p: YT.Player) => void
        onStateChange?: (e: YT.OnStateChangeEvent) => void
      }) => {
        capturedStateChange = params.onStateChange
        params.onReady?.(mockPlayerInstance)
        return mockPlayerInstance
      },
    )

    render(<TvPlayer channel={channel} position={position} isMuted={false} />)

    await vi.waitFor(() => expect(mockCreatePlayer).toHaveBeenCalled())

    // Simulate the video ending
    capturedStateChange?.({ target: mockPlayerInstance, data: 0 })

    expect(mockGetSchedulePosition).toHaveBeenCalledWith(
      channel,
      expect.any(Date),
    )
    expect(mockLoadVideo).toHaveBeenCalledWith(mockPlayerInstance, 'v2', 5)
  })

  it('does not call loadVideo when a non-ENDED state fires', async () => {
    const channel = makeChannel()
    const position = makePosition()
    let capturedStateChange:
      | ((event: YT.OnStateChangeEvent) => void)
      | undefined

    mockCreatePlayer.mockImplementation(
      async (params: {
        onReady?: (p: YT.Player) => void
        onStateChange?: (e: YT.OnStateChangeEvent) => void
      }) => {
        capturedStateChange = params.onStateChange
        params.onReady?.(mockPlayerInstance)
        return mockPlayerInstance
      },
    )

    render(<TvPlayer channel={channel} position={position} isMuted={false} />)
    await vi.waitFor(() => expect(mockCreatePlayer).toHaveBeenCalled())

    capturedStateChange?.({ target: mockPlayerInstance, data: 1 }) // PLAYING

    expect(mockLoadVideo).not.toHaveBeenCalled()
  })

  it('re-creates the player when channel.id changes', async () => {
    const channel1 = makeChannel()
    const channel2: Channel = {
      ...makeChannel(),
      id: 'space',
      number: 2,
      name: 'Space',
    }
    const position = makePosition()

    const { rerender } = render(
      <TvPlayer channel={channel1} position={position} isMuted={false} />,
    )
    await vi.waitFor(() => expect(mockCreatePlayer).toHaveBeenCalledOnce())

    rerender(
      <TvPlayer channel={channel2} position={position} isMuted={false} />,
    )
    await vi.waitFor(() => expect(mockCreatePlayer).toHaveBeenCalledTimes(2))
  })

  it('does not throw when createPlayer rejects', async () => {
    mockCreatePlayer.mockRejectedValue(new Error('Container not found'))

    const channel = makeChannel()
    const position = makePosition()

    expect(() =>
      render(
        <TvPlayer channel={channel} position={position} isMuted={false} />,
      ),
    ).not.toThrow()
    await vi.waitFor(() => expect(mockCreatePlayer).toHaveBeenCalled())
  })

  it('renders the inner div with id youtube-player', () => {
    render(
      <TvPlayer
        channel={makeChannel()}
        position={makePosition()}
        isMuted={false}
      />,
    )
    const inner = document.getElementById('youtube-player')
    expect(inner).not.toBeNull()
    expect(inner?.className).toContain('w-full')
    expect(inner?.className).toContain('h-full')
  })

  it('mounts without throwing', () => {
    expect(() =>
      render(
        <TvPlayer
          channel={makeChannel()}
          position={makePosition()}
          isMuted={false}
        />,
      ),
    ).not.toThrow()
  })
})
