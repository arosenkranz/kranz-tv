import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createShuffleQueue } from '~/lib/surf/shuffle'
import {
  trackSurfModeStart,
  trackSurfModeStop,
  trackSurfHop,
  trackSurfDwellChange,
} from '~/lib/datadog/rum'
import { useLocalStorage } from '~/hooks/use-local-storage'
import { useSurfMode } from '~/hooks/use-surf-mode'
import type { ChannelNavEntry } from '~/hooks/use-channel-navigation'

vi.mock('~/lib/surf/shuffle', () => ({
  createShuffleQueue: vi.fn(),
}))

vi.mock('~/lib/datadog/rum', () => ({
  trackSurfModeStart: vi.fn(),
  trackSurfModeStop: vi.fn(),
  trackSurfHop: vi.fn(),
  trackSurfSkip: vi.fn(),
  trackSurfDwellChange: vi.fn(),
}))

vi.mock('~/hooks/use-local-storage', () => ({
  useLocalStorage: vi.fn(),
}))

const mockNavigate = vi.fn()
const mockSetNavigationSource = vi.fn()

const defaultChannels: ChannelNavEntry[] = [
  { id: 'ch1', number: 1 },
  { id: 'ch2', number: 2 },
  { id: 'ch3', number: 3 },
  { id: 'ch4', number: 4 },
]

function renderSurfHook(overrides = {}) {
  return renderHook(() =>
    useSurfMode({
      allChannels: defaultChannels,
      currentChannelId: 'ch1',
      navigate: mockNavigate,
      isOverlayOpen: false,
      isChannelLoading: false,
      setNavigationSource: mockSetNavigationSource,
      ...overrides,
    }),
  )
}

describe('useSurfMode', () => {
  let mockStoredDwell: number
  let mockSetStoredDwell: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    mockStoredDwell = 15
    mockSetStoredDwell = vi.fn((val: number) => {
      mockStoredDwell = val
    })
    vi.mocked(useLocalStorage).mockImplementation(() => [
      mockStoredDwell,
      mockSetStoredDwell,
    ])
    vi.mocked(createShuffleQueue).mockReturnValue(['ch2', 'ch3', 'ch4'])
    mockNavigate.mockClear()
    mockSetNavigationSource.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts with isSurfing false', () => {
    const { result } = renderSurfHook()
    expect(result.current.isSurfing).toBe(false)
    expect(result.current.countdown).toBe(0)
  })

  it('startSurf sets isSurfing true and creates shuffle queue', () => {
    const { result } = renderSurfHook()

    act(() => {
      result.current.startSurf()
    })

    expect(result.current.isSurfing).toBe(true)
    expect(createShuffleQueue).toHaveBeenCalledWith(
      ['ch1', 'ch2', 'ch3', 'ch4'],
      'ch1',
    )
  })

  it('startSurf is no-op with fewer than 2 channels', () => {
    const { result } = renderSurfHook({
      allChannels: [{ id: 'ch1', number: 1 }],
    })

    act(() => {
      result.current.startSurf()
    })

    expect(result.current.isSurfing).toBe(false)
  })

  it('countdown computes from deadline', () => {
    const { result } = renderSurfHook()

    act(() => {
      result.current.startSurf()
    })

    expect(result.current.countdown).toBe(15)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.countdown).toBe(12)
  })

  it('navigates to next queue entry when deadline reached', () => {
    vi.mocked(createShuffleQueue).mockReturnValue(['ch2', 'ch3', 'ch4'])
    const { result } = renderSurfHook()

    act(() => {
      result.current.startSurf()
    })

    act(() => {
      vi.advanceTimersByTime(15_000)
    })

    expect(mockSetNavigationSource).toHaveBeenCalledWith('surf')
    expect(mockNavigate).toHaveBeenCalledWith('ch2')
  })

  it('resets deadline after hop and navigates again', () => {
    vi.mocked(createShuffleQueue).mockReturnValue(['ch2', 'ch3', 'ch4'])
    const { result } = renderSurfHook()

    act(() => {
      result.current.startSurf()
    })

    // First hop
    act(() => {
      vi.advanceTimersByTime(15_000)
    })

    expect(mockNavigate).toHaveBeenCalledWith('ch2')

    // Second hop
    act(() => {
      vi.advanceTimersByTime(15_000)
    })

    expect(mockNavigate).toHaveBeenCalledWith('ch3')
  })

  it('stopSurf clears interval and resets state', () => {
    const { result } = renderSurfHook()

    act(() => {
      result.current.startSurf()
    })

    expect(result.current.isSurfing).toBe(true)

    // Advance past debounce window before stopping
    act(() => {
      vi.advanceTimersByTime(200)
    })

    act(() => {
      result.current.stopSurf()
    })

    expect(result.current.isSurfing).toBe(false)

    // Advance past what would be the deadline — no navigation
    mockNavigate.mockClear()
    act(() => {
      vi.advanceTimersByTime(20_000)
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('debounces rapid toggle (start then immediate stop then start)', () => {
    const { result } = renderSurfHook()

    // Start surf
    act(() => {
      result.current.startSurf()
    })

    expect(result.current.isSurfing).toBe(true)

    // Immediately try to stop — within 150ms debounce
    act(() => {
      result.current.stopSurf()
    })

    // stopSurf should be debounced, so still surfing
    expect(result.current.isSurfing).toBe(true)
  })

  it('timer pauses when overlay opens and resumes on close', () => {
    const { result, rerender } = renderHook(
      ({ isOverlayOpen }: { isOverlayOpen: boolean }) =>
        useSurfMode({
          allChannels: defaultChannels,
          currentChannelId: 'ch1',
          navigate: mockNavigate,
          isOverlayOpen,
          isChannelLoading: false,
          setNavigationSource: mockSetNavigationSource,
        }),
      { initialProps: { isOverlayOpen: false } },
    )

    // Start surfing
    act(() => {
      result.current.startSurf()
    })

    // Advance 7 seconds (about half of 15s dwell)
    act(() => {
      vi.advanceTimersByTime(7000)
    })

    expect(mockNavigate).not.toHaveBeenCalled()

    // Open overlay — timer should pause
    act(() => {
      rerender({ isOverlayOpen: true })
    })

    // Advance well past the original deadline
    act(() => {
      vi.advanceTimersByTime(20_000)
    })

    expect(mockNavigate).not.toHaveBeenCalled()

    // Close overlay — timer resumes
    act(() => {
      rerender({ isOverlayOpen: false })
    })

    // Advance the remaining ~8 seconds
    act(() => {
      vi.advanceTimersByTime(9000)
    })

    expect(mockNavigate).toHaveBeenCalledWith('ch2')
  })

  it('queue rebuilds when channel list changes during surf', () => {
    const { result, rerender } = renderHook(
      ({ allChannels }: { allChannels: ChannelNavEntry[] }) =>
        useSurfMode({
          allChannels,
          currentChannelId: 'ch1',
          navigate: mockNavigate,
          isOverlayOpen: false,
          isChannelLoading: false,
          setNavigationSource: mockSetNavigationSource,
        }),
      { initialProps: { allChannels: defaultChannels } },
    )

    act(() => {
      result.current.startSurf()
    })

    // createShuffleQueue called once for startSurf
    expect(createShuffleQueue).toHaveBeenCalledTimes(1)

    // Change channel list
    const newChannels: ChannelNavEntry[] = [
      ...defaultChannels,
      { id: 'ch5', number: 5 },
    ]

    act(() => {
      rerender({ allChannels: newChannels })
    })

    // Should have been called again with new channel list
    expect(createShuffleQueue).toHaveBeenCalledTimes(2)
  })

  it('dwell is clamped to minimum of 5', () => {
    const { result } = renderSurfHook()

    act(() => {
      result.current.setDwellSeconds(3)
    })

    expect(mockSetStoredDwell).toHaveBeenCalledWith(5)
  })

  it('dwell is clamped to maximum of 60', () => {
    const { result } = renderSurfHook()

    act(() => {
      result.current.setDwellSeconds(100)
    })

    expect(mockSetStoredDwell).toHaveBeenCalledWith(60)
  })

  it('stopSurf tracks RUM event', () => {
    const { result } = renderSurfHook()

    act(() => {
      result.current.startSurf()
    })

    // Advance past debounce window
    act(() => {
      vi.advanceTimersByTime(200)
    })

    act(() => {
      result.current.stopSurf()
    })

    expect(trackSurfModeStop).toHaveBeenCalled()
  })

  it('startSurf tracks RUM event', () => {
    renderSurfHook()

    const { result } = renderSurfHook()

    act(() => {
      result.current.startSurf()
    })

    expect(trackSurfModeStart).toHaveBeenCalledWith(15, 4, 'keyboard')
  })

  it('hop tracks RUM event', () => {
    vi.mocked(createShuffleQueue).mockReturnValue(['ch2', 'ch3', 'ch4'])
    const { result } = renderSurfHook()

    act(() => {
      result.current.startSurf()
    })

    act(() => {
      vi.advanceTimersByTime(15_000)
    })

    expect(trackSurfHop).toHaveBeenCalledWith('ch1', 'ch2', 0, 3)
  })

  it('setDwellSeconds tracks RUM event', () => {
    const { result } = renderSurfHook()

    act(() => {
      result.current.setDwellSeconds(20)
    })

    expect(trackSurfDwellChange).toHaveBeenCalledWith(20, 15, 'keyboard')
  })

  it('returns dwellSeconds from localStorage', () => {
    mockStoredDwell = 25
    vi.mocked(useLocalStorage).mockReturnValue([25, mockSetStoredDwell])

    const { result } = renderSurfHook()

    expect(result.current.dwellSeconds).toBe(25)
  })
})
