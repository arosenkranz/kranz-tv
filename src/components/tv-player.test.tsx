import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import type { Channel, SchedulePosition, Video } from '~/lib/scheduling/types'

import { TvPlayer } from './tv-player'
import { mockPlayer } from '~/test/yt-player-mock'

const {
  mockLoadYouTubeAPI,
  mockCreatePlayer,
  mockLoadVideo,
  mockGetSchedulePosition,
  logs,
  rum,
} = vi.hoisted(() => ({
  mockLoadYouTubeAPI: vi.fn(),
  mockCreatePlayer: vi.fn(),
  mockLoadVideo: vi.fn(),
  mockGetSchedulePosition: vi.fn(),
  logs: {
    logPlayerError: vi.fn(),
    logPlayerCreationFailed: vi.fn(),
    logScheduleDesync: vi.fn(),
  },
  rum: {
    trackPlayerError: vi.fn(),
    trackPlayerResync: vi.fn(),
  },
}))

vi.mock('~/lib/datadog/logs', async (orig) => {
  const actual = await orig<typeof import('~/lib/datadog/logs')>()
  return { ...actual, ...logs }
})

vi.mock('~/lib/datadog/rum', async (orig) => {
  const actual = await orig<typeof import('~/lib/datadog/rum')>()
  return { ...actual, ...rum }
})

vi.mock('~/lib/player/youtube-iframe', () => ({
  loadYouTubeAPI: mockLoadYouTubeAPI,
  createPlayer: mockCreatePlayer,
  loadVideo: mockLoadVideo,
}))

vi.mock('~/lib/scheduling/algorithm', () => ({
  getSchedulePosition: mockGetSchedulePosition,
}))

const makeChannel = (): Channel => ({
  kind: 'video',
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
  item: {
    id: videoId,
    title: 'Bears',
    durationSeconds: 300,
    thumbnailUrl: 'https://img/bears.jpg',
  } as Video,
  seekSeconds,
  slotStartTime: new Date('2024-01-01T00:00:00Z'),
  slotEndTime: new Date('2024-01-01T00:05:00Z'),
})

describe('TvPlayer', () => {
  let mockPlayerInstance: YT.Player

  beforeEach(() => {
    mockPlayerInstance = mockPlayer({
      destroy: vi.fn(),
      loadVideoById: vi.fn(),
      mute: vi.fn(),
      unMute: vi.fn(),
      playVideo: vi.fn(),
    })

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
    const { container } = render(
      <TvPlayer channel={channel} position={position} isMuted={false} />,
    )
    // Per-instance container id: id is `youtube-player-<useId>`, so match by prefix.
    expect(
      container.querySelector('[id^="youtube-player-"]'),
    ).not.toBeNull()
  })

  it('renders with w-full h-full bg-black wrapper', () => {
    const channel = makeChannel()
    const position = makePosition()
    const { container } = render(
      <TvPlayer channel={channel} position={position} isMuted={false} />,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('w-full')
    expect(wrapper.className).toContain('h-full')
    expect(wrapper.className).toContain('bg-black')
  })

  it('calls loadYouTubeAPI and createPlayer on mount', async () => {
    const channel = makeChannel()
    const position = makePosition('v1', 42)
    // Player creation computes a fresh position via getSchedulePosition —
    // ensure the mock returns the expected position for this test.
    mockGetSchedulePosition.mockReturnValue(position)

    render(<TvPlayer channel={channel} position={position} isMuted={false} />)

    // Let the promises flush
    await vi.waitFor(() => {
      expect(mockLoadYouTubeAPI).toHaveBeenCalledOnce()
    })

    expect(mockCreatePlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        containerId: expect.stringMatching(/^youtube-player-/),
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

  it('renders the inner div with a per-instance youtube-player id', () => {
    const { container } = render(
      <TvPlayer
        channel={makeChannel()}
        position={makePosition()}
        isMuted={false}
      />,
    )
    const inner = container.querySelector<HTMLElement>(
      '[id^="youtube-player-"]',
    )
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

// ---------------------------------------------------------------------------
// Player lifecycle callbacks (mute/volume sync, state transitions, errors)
// ---------------------------------------------------------------------------

describe('TvPlayer player callbacks', () => {
  let mockPlayerInstance: YT.Player
  let capturedParams: {
    onReady?: (p: YT.Player) => void
    onStateChange?: (e: YT.OnStateChangeEvent) => void
    onError?: (e: YT.OnStateChangeEvent) => void
  }

  /** Create a player immediately and capture the event callbacks. */
  const mountPlayer = async (
    props: Partial<Parameters<typeof TvPlayer>[0]> = {},
  ) => {
    mockCreatePlayer.mockImplementation(
      async (params: {
        onReady?: (p: YT.Player) => void
        onStateChange?: (e: YT.OnStateChangeEvent) => void
        onError?: (e: YT.OnStateChangeEvent) => void
      }) => {
        capturedParams = params
        params.onReady?.(mockPlayerInstance)
        return mockPlayerInstance
      },
    )
    const utils = render(
      <TvPlayer
        channel={makeChannel()}
        position={makePosition()}
        isMuted={false}
        {...props}
      />,
    )
    await vi.waitFor(() => expect(mockCreatePlayer).toHaveBeenCalled())
    return utils
  }

  /** Clear a player-mock method while keeping the YT.Player typing intact. */
  const clearPlayerCall = (fn: unknown): void => {
    ;(fn as ReturnType<typeof vi.fn>).mockClear()
  }

  beforeEach(() => {
    vi.resetAllMocks()
    mockPlayerInstance = mockPlayer({
      destroy: vi.fn(),
      mute: vi.fn(),
      unMute: vi.fn(),
      playVideo: vi.fn(),
      setVolume: vi.fn(),
      getPlayerState: vi.fn(() => 1),
    })
    capturedParams = {}
    mockLoadYouTubeAPI.mockResolvedValue(undefined)
    mockGetSchedulePosition.mockReturnValue(makePosition('v2', 5))
  })

  it('syncs mute to the player when isMuted flips', async () => {
    const { rerender } = await mountPlayer({ isMuted: false })
    clearPlayerCall(mockPlayerInstance.mute)
    clearPlayerCall(mockPlayerInstance.unMute)

    rerender(
      <TvPlayer
        channel={makeChannel()}
        position={makePosition()}
        isMuted={true}
      />,
    )
    expect(mockPlayerInstance.mute).toHaveBeenCalledOnce()

    rerender(
      <TvPlayer
        channel={makeChannel()}
        position={makePosition()}
        isMuted={false}
      />,
    )
    expect(mockPlayerInstance.unMute).toHaveBeenCalledOnce()
  })

  it('syncs volume changes to the player', async () => {
    const { rerender } = await mountPlayer({ volume: 80 })

    rerender(
      <TvPlayer
        channel={makeChannel()}
        position={makePosition()}
        isMuted={false}
        volume={30}
      />,
    )

    expect(mockPlayerInstance.setVolume).toHaveBeenCalledWith(30)
  })

  it('applies volume, mute, and playback on ready; relays onPlayerReady', async () => {
    const onPlayerReady = vi.fn()
    mockCreatePlayer.mockImplementation(
      async (params: { onReady?: (p: YT.Player) => void }) => {
        capturedParams = params
        params.onReady?.(mockPlayerInstance)
        return mockPlayerInstance
      },
    )

    render(
      <TvPlayer
        channel={makeChannel()}
        position={makePosition()}
        isMuted={true}
        volume={55}
        onPlayerReady={onPlayerReady}
      />,
    )
    await vi.waitFor(() => expect(mockCreatePlayer).toHaveBeenCalled())

    expect(onPlayerReady).toHaveBeenCalledWith(mockPlayerInstance)
    expect(mockPlayerInstance.setVolume).toHaveBeenCalledWith(55)
    expect(mockPlayerInstance.mute).toHaveBeenCalledOnce()
    expect(mockPlayerInstance.unMute).not.toHaveBeenCalled()
    expect(mockPlayerInstance.playVideo).toHaveBeenCalledOnce()
  })

  it('destroys the player when onReady fires after unmount', async () => {
    mockCreatePlayer.mockImplementation(
      async (params: { onReady?: (p: YT.Player) => void }) => {
        capturedParams = params
        return mockPlayerInstance
      },
    )

    const { unmount } = render(
      <TvPlayer
        channel={makeChannel()}
        position={makePosition()}
        isMuted={false}
      />,
    )
    await vi.waitFor(() => expect(mockCreatePlayer).toHaveBeenCalled())
    unmount()

    // onReady arrives after the effect cleanup already ran: the player must
    // be destroyed instead of being adopted by the dead component.
    capturedParams.onReady?.(mockPlayerInstance)
    expect(mockPlayerInstance.destroy).toHaveBeenCalledOnce()
  })

  it('unmutes on first PLAYING; blocked autoplay (pause after 50ms) re-mutes and prompts', async () => {
    vi.useFakeTimers()
    try {
      const onNeedsInteraction = vi.fn()
      mockPlayerInstance.getPlayerState = vi.fn(() => 2) // PAUSED after the unMute attempt

      await mountPlayer({ onNeedsInteraction })
      clearPlayerCall(mockPlayerInstance.unMute)
      clearPlayerCall(mockPlayerInstance.playVideo)

      capturedParams.onStateChange?.({ target: mockPlayerInstance, data: 1 })
      expect(mockPlayerInstance.unMute).toHaveBeenCalledOnce()

      act(() => {
        vi.advanceTimersByTime(50)
      })

      expect(mockPlayerInstance.mute).toHaveBeenCalledOnce()
      expect(mockPlayerInstance.playVideo).toHaveBeenCalledOnce()
      expect(onNeedsInteraction).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('first PLAYING while muted does not attempt an unmute', async () => {
    await mountPlayer({ isMuted: true })
    clearPlayerCall(mockPlayerInstance.unMute)

    capturedParams.onStateChange?.({ target: mockPlayerInstance, data: 1 })

    expect(mockPlayerInstance.unMute).not.toHaveBeenCalled()
  })

  it('resyncs after a genuine pause: loads the live video and emits telemetry', async () => {
    vi.useFakeTimers()
    try {
      const onResync = vi.fn()
      await mountPlayer({ onResync })
      // First PLAYING marks the player as unmuted so PAUSED is honored
      capturedParams.onStateChange?.({ target: mockPlayerInstance, data: 1 })

      mockPlayerInstance.getPlayerState = vi.fn(() => 2) // still paused
      capturedParams.onStateChange?.({ target: mockPlayerInstance, data: 2 })

      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(rum.trackPlayerResync).toHaveBeenCalledWith('nature', 'v2')
      expect(logs.logScheduleDesync).toHaveBeenCalledWith('nature', 'v2')
      expect(onResync).toHaveBeenCalledOnce()
      expect(mockLoadVideo).toHaveBeenCalledWith(mockPlayerInstance, 'v2', 5)
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores a transient pause that resumes before the 300ms debounce', async () => {
    vi.useFakeTimers()
    try {
      const onResync = vi.fn()
      await mountPlayer({ onResync })
      capturedParams.onStateChange?.({ target: mockPlayerInstance, data: 1 })

      capturedParams.onStateChange?.({ target: mockPlayerInstance, data: 2 })
      // Buffering resolved: the player reports PLAYING before the debounce fires
      mockPlayerInstance.getPlayerState = vi.fn(() => 1)

      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(onResync).not.toHaveBeenCalled()
      expect(mockLoadVideo).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores PAUSED events before the first PLAYING (hasUnmuted gate)', async () => {
    vi.useFakeTimers()
    try {
      const onResync = vi.fn()
      await mountPlayer({ onResync })

      capturedParams.onStateChange?.({ target: mockPlayerInstance, data: 2 })
      act(() => {
        vi.advanceTimersByTime(300)
      })

      expect(onResync).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports player errors to telemetry and logs', async () => {
    await mountPlayer()

    capturedParams.onError?.({
      target: mockPlayerInstance,
      data: 101 as unknown as YT.PlayerState,
    })

    expect(rum.trackPlayerError).toHaveBeenCalledWith(
      101,
      'v1',
      'nature',
    )
    expect(logs.logPlayerError).toHaveBeenCalledWith(101, 'v1', 'nature')
  })

  it('logs a creation failure when the YouTube API rejects', async () => {
    mockLoadYouTubeAPI.mockRejectedValue(new Error('script blocked'))

    render(
      <TvPlayer
        channel={makeChannel()}
        position={makePosition()}
        isMuted={false}
      />,
    )

    await vi.waitFor(() =>
      expect(logs.logPlayerCreationFailed).toHaveBeenCalledWith(
        'nature',
        'script blocked',
      ),
    )
  })

  it('enables pointer events on the wrapper when allowInteraction is set', () => {
    const { container } = render(
      <TvPlayer
        channel={makeChannel()}
        position={makePosition()}
        isMuted={false}
        allowInteraction={true}
      />,
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.pointerEvents).toBe('auto')
  })
})
