import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCurrentProgram } from './use-current-program'
import type { Channel, SchedulePosition, Video } from '~/lib/scheduling/types'

import { getSchedulePosition } from '~/lib/scheduling/algorithm'

vi.mock('~/lib/scheduling/algorithm', () => ({
  getSchedulePosition: vi.fn(),
}))

const mockGetSchedulePosition = vi.mocked(getSchedulePosition)

const makeChannel = (overrides: Partial<Channel> = {}): Channel =>
  ({
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
    ],
    totalDurationSeconds: 300,
    ...overrides,
  }) as Channel

const makePosition = (videoId = 'v1', seekSeconds = 42): SchedulePosition => ({
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

describe('useCurrentProgram', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockGetSchedulePosition.mockReturnValue(makePosition())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('returns null when channel is null', () => {
    const { result } = renderHook(() => useCurrentProgram(null))
    expect(result.current).toBeNull()
  })

  it('returns the initial schedule position on mount', () => {
    const channel = makeChannel()
    const pos = makePosition('v1', 10)
    mockGetSchedulePosition.mockReturnValue(pos)

    const { result } = renderHook(() => useCurrentProgram(channel))
    expect(result.current).toBe(pos)
    expect(mockGetSchedulePosition).toHaveBeenCalledWith(
      channel,
      expect.any(Date),
    )
  })

  it('updates position every 1000ms via interval', () => {
    const channel = makeChannel()
    const pos1 = makePosition('v1', 10)
    const pos2 = makePosition('v1', 11)

    // First call(s) during initial render return pos1; after 1s tick return pos2.
    mockGetSchedulePosition.mockReturnValueOnce(pos1).mockReturnValue(pos2)

    const { result } = renderHook(() => useCurrentProgram(channel))
    expect(result.current).toBe(pos1)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current).toBe(pos2)
  })

  it('clears the interval and returns null when channel becomes null', () => {
    const channel = makeChannel()
    mockGetSchedulePosition.mockReturnValue(makePosition())

    const { result, rerender } = renderHook(
      ({ ch }: { ch: Channel | null }) => useCurrentProgram(ch),
      { initialProps: { ch: channel as Channel | null } },
    )

    expect(result.current).not.toBeNull()

    rerender({ ch: null })
    expect(result.current).toBeNull()

    const callCount = mockGetSchedulePosition.mock.calls.length

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    // No new calls after channel nulled — interval was cleared
    expect(mockGetSchedulePosition.mock.calls.length).toBe(callCount)
  })

  it('resets the interval and re-queries when channel changes', () => {
    const ch1 = makeChannel({ id: 'nature', number: 1 })
    const ch2 = makeChannel({ id: 'space', number: 2 })
    const pos1 = makePosition('v1', 0)
    const pos2 = makePosition('v2', 5)

    // Position is computed synchronously during render — one call per render.
    // First render with ch1 → pos1; rerender with ch2 → pos2.
    mockGetSchedulePosition
      .mockReturnValueOnce(pos1) // initial render with ch1
      .mockReturnValue(pos2) // rerender with ch2 + interval ticks

    const { result, rerender } = renderHook(
      ({ ch }: { ch: Channel }) => useCurrentProgram(ch),
      { initialProps: { ch: ch1 } },
    )

    expect(result.current).toBe(pos1)

    rerender({ ch: ch2 })

    expect(result.current).toBe(pos2)
    expect(mockGetSchedulePosition).toHaveBeenCalledWith(ch2, expect.any(Date))
  })

  it('cleans up interval on unmount', () => {
    const channel = makeChannel()
    mockGetSchedulePosition.mockReturnValue(makePosition())

    const { unmount } = renderHook(() => useCurrentProgram(channel))
    const callsBefore = mockGetSchedulePosition.mock.calls.length
    unmount()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(mockGetSchedulePosition.mock.calls.length).toBe(callsBefore)
  })
})
