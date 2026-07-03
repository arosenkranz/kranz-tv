import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import type {
  MusicChannel,
  SchedulePosition,
  Track,
} from '~/lib/scheduling/types'
import { MusicChannelView } from '~/components/music-channel-view'
import { ScWidgetProvider } from '~/lib/sources/soundcloud/sc-widget-context'
import type { useScWidget } from '~/lib/sources/soundcloud/sc-widget-context'

type ScWidgetContextValue = ReturnType<typeof useScWidget>

const { MockRenderer, widgetOverride } = vi.hoisted(() => {
  const instance = {
    setPreset: () => {},
    setIntensityLevel: () => {},
    start: () => {},
    setTrackPosition: () => {},
    dispose: () => {},
  }
  return {
    MockRenderer: vi.fn(() => instance),
    // Mutable holder: when set, the mocked useScWidget returns this instead of
    // the real context value. Lets specific tests force status/activeChannelId
    // while leaving the rest of the suite on the real ScWidgetProvider.
    widgetOverride: { current: null as ScWidgetContextValue | null },
  }
})

vi.mock('~/lib/visualizers/renderer', () => ({
  VisualizerRenderer: MockRenderer,
}))

vi.mock('~/lib/sources/soundcloud/sc-widget-context', async () => {
  const actual = await vi.importActual<
    typeof import('~/lib/sources/soundcloud/sc-widget-context')
  >('~/lib/sources/soundcloud/sc-widget-context')
  return {
    ...actual,
    useScWidget: () => widgetOverride.current ?? actual.useScWidget(),
  }
})

const makeTrack = (id: string, title: string, artist: string): Track => ({
  id,
  title,
  artist,
  durationSeconds: 180,
  embedUrl: `https://w.soundcloud.com/player/?url=sc/${id}`,
})

const makeChannel = (overrides: Partial<MusicChannel> = {}): MusicChannel => ({
  kind: 'music',
  id: 'test-music',
  number: 99,
  name: 'Test Music Channel',
  source: 'soundcloud',
  sourceUrl: 'https://soundcloud.com/artist/sets/my-playlist',
  totalDurationSeconds: 360,
  trackCount: 2,
  tracks: [
    makeTrack('t1', 'Track One', 'Artist A'),
    makeTrack('t2', 'Track Two', 'Artist B'),
  ],
  ...overrides,
})

const makePosition = (track: Track): SchedulePosition => ({
  item: track,
  seekSeconds: 30,
  slotStartTime: new Date('2024-01-01T00:00:00Z'),
  slotEndTime: new Date('2024-01-01T00:03:00Z'),
})

beforeEach(() => {
  ;(window as unknown as Record<string, unknown>).matchMedia = vi
    .fn()
    .mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
})

afterEach(() => {
  widgetOverride.current = null
  vi.restoreAllMocks()
})

function renderInProvider(ui: React.ReactElement) {
  return render(<ScWidgetProvider>{ui}</ScWidgetProvider>)
}

describe('MusicChannelView', () => {
  describe('loading mode (position=null)', () => {
    it('renders the visualizer canvas while the playlist is still resolving', () => {
      const stub = makeChannel({ tracks: [], trackCount: 0, totalDurationSeconds: 0 })

      renderInProvider(
        <MusicChannelView
          channel={stub}
          position={null}
          isMuted={false}
          volume={0.5}
          onUnmute={() => {}}
          activePreset="spectrum"
        />,
      )

      expect(screen.getByTestId('music-visualizer-canvas')).toBeTruthy()
    })

    it('shows the TUNING overlay with thinned static over the idle visualizer', () => {
      const stub = makeChannel({ tracks: [], trackCount: 0, totalDurationSeconds: 0 })

      renderInProvider(
        <MusicChannelView
          channel={stub}
          position={null}
          isMuted={false}
          volume={0.5}
          onUnmute={() => {}}
        />,
      )

      expect(screen.getByTestId('tuning-overlay')).toBeTruthy()
      const staticEl = screen.getByTestId('tuning-static')
      expect(staticEl.style.opacity).toBe('0.35')
    })

    it('hides track-dependent UI (now-playing card, status badge, unmute button)', () => {
      const stub = makeChannel({ tracks: [], trackCount: 0, totalDurationSeconds: 0 })

      renderInProvider(
        <MusicChannelView
          channel={stub}
          position={null}
          isMuted={true}
          volume={0.5}
          onUnmute={() => {}}
        />,
      )

      expect(screen.queryByText('OPEN ON SOUNDCLOUD')).toBeNull()
      expect(screen.queryByText('TAP TO UNMUTE')).toBeNull()
      expect(screen.queryByText(/●/)).toBeNull()
    })
  })

  it('keeps full-strength static in the TUNING overlay once real data arrives', () => {
    const channel = makeChannel()
    const track = channel.tracks![0]

    renderInProvider(
      <MusicChannelView
        channel={channel}
        position={makePosition(track)}
        isMuted={false}
        volume={0.5}
        onUnmute={() => {}}
      />,
    )

    const staticEl = screen.getByTestId('tuning-static')
    expect(staticEl.style.opacity).toBe('0.7')
  })

  it('renders the music visualizer canvas', () => {
    const channel = makeChannel()
    const track = channel.tracks![0]
    const position = makePosition(track)

    renderInProvider(
      <MusicChannelView
        channel={channel}
        position={position}
        isMuted={false}
        volume={0.5}
        onUnmute={() => {}}
        activePreset="spectrum"
      />,
    )

    expect(screen.getByTestId('music-visualizer-canvas')).toBeTruthy()
  })

  it('mounts MusicVisualizerCanvas when isMuted is false', () => {
    const channel = makeChannel()
    const track = channel.tracks![0]
    const position = makePosition(track)

    renderInProvider(
      <MusicChannelView
        channel={channel}
        position={position}
        isMuted={false}
        volume={0.5}
        onUnmute={() => {}}
        activePreset="kaleidoscope"
      />,
    )

    expect(screen.getByTestId('music-visualizer-canvas')).toBeTruthy()
  })

  it('renders the Now Playing card with track title and artist', () => {
    const channel = makeChannel()
    const track = channel.tracks![0]
    const position = makePosition(track)

    renderInProvider(
      <MusicChannelView
        channel={channel}
        position={position}
        isMuted={false}
        volume={0.5}
        onUnmute={() => {}}
      />,
    )

    expect(screen.getByText('Track One')).toBeTruthy()
    expect(screen.getByText('Artist A')).toBeTruthy()
  })

  it('shows tap-to-unmute when isMuted is true', () => {
    const channel = makeChannel()
    const track = channel.tracks![0]
    const position = makePosition(track)

    renderInProvider(
      <MusicChannelView
        channel={channel}
        position={position}
        isMuted={true}
        volume={0.5}
        onUnmute={() => {}}
      />,
    )

    expect(screen.getByText(/tap to unmute/i)).toBeTruthy()
  })

  it('calls onUnmute when the unmute button is clicked', () => {
    const onUnmute = vi.fn()
    const channel = makeChannel()
    const track = channel.tracks![0]
    const position = makePosition(track)

    renderInProvider(
      <MusicChannelView
        channel={channel}
        position={position}
        isMuted={true}
        volume={0.5}
        onUnmute={onUnmute}
      />,
    )

    const btn = screen.getByRole('button', { name: /tap to unmute/i })
    btn.click()
    expect(onUnmute).toHaveBeenCalledOnce()
  })

  it('renders the SoundCloud iframe with correct sandbox attributes', () => {
    const channel = makeChannel()
    const track = channel.tracks![0]
    const position = makePosition(track)

    const { container } = renderInProvider(
      <MusicChannelView
        channel={channel}
        position={position}
        isMuted={true}
        volume={0.5}
        onUnmute={() => {}}
      />,
    )

    const iframe = container.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.getAttribute('sandbox')).toContain('allow-scripts')
    expect(iframe?.getAttribute('sandbox')).toContain('allow-same-origin')
    expect(iframe?.getAttribute('sandbox')).not.toContain(
      'allow-top-navigation',
    )
  })

  it('shows the TUNING overlay while the SC channel is mounting and active', () => {
    const channel = makeChannel()
    const track = channel.tracks![0]
    const position = makePosition(track)

    // Active channel + mounting → overlay visible.
    widgetOverride.current = {
      widget: null,
      status: 'mounting',
      activeChannelId: channel.id,
      isReady: false,
      setActiveChannel: () => {},
    }

    renderInProvider(
      <MusicChannelView
        channel={channel}
        position={position}
        isMuted={false}
        volume={0.5}
        onUnmute={() => {}}
        activePreset="spectrum"
      />,
    )

    expect(screen.getByTestId('tuning-overlay')).toBeTruthy()
  })

  it('clears the TUNING overlay once the active channel is playing', () => {
    const channel = makeChannel()
    const track = channel.tracks![0]
    const position = makePosition(track)

    // Active channel + playing → audio is up, overlay cleared.
    widgetOverride.current = {
      widget: null,
      status: 'playing',
      activeChannelId: channel.id,
      isReady: true,
      setActiveChannel: () => {},
    }

    renderInProvider(
      <MusicChannelView
        channel={channel}
        position={position}
        isMuted={false}
        volume={0.5}
        onUnmute={() => {}}
        activePreset="spectrum"
      />,
    )

    expect(screen.queryByTestId('tuning-overlay')).toBeNull()
  })

  describe('overlay auto-hide', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    function renderWithTrack(status: 'playing' | 'error' = 'playing') {
      const channel = makeChannel()
      const track = channel.tracks![0]

      widgetOverride.current = {
        widget: null,
        status,
        activeChannelId: channel.id,
        isReady: true,
        setActiveChannel: () => {},
      }

      return renderInProvider(
        <MusicChannelView
          channel={channel}
          position={makePosition(track)}
          isMuted={false}
          volume={0.5}
          onUnmute={() => {}}
          activePreset="spectrum"
        />,
      )
    }

    it('shows both overlays on mount, then fades them after 3s of inactivity', () => {
      renderWithTrack()

      expect(screen.getByTestId('music-status-badge').style.opacity).toBe('1')
      expect(screen.getByTestId('now-playing-wrapper').style.opacity).toBe('1')

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(screen.getByTestId('music-status-badge').style.opacity).toBe('0')
      expect(screen.getByTestId('now-playing-wrapper').style.opacity).toBe('0')
    })

    it('blocks pointer events on the now-playing card while hidden', () => {
      renderWithTrack()

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(screen.getByTestId('now-playing-wrapper').style.pointerEvents).toBe(
        'none',
      )
    })

    it('re-shows the overlays on mouse movement', () => {
      renderWithTrack()

      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(screen.getByTestId('now-playing-wrapper').style.opacity).toBe('0')

      act(() => {
        fireEvent.mouseMove(window)
      })

      expect(screen.getByTestId('music-status-badge').style.opacity).toBe('1')
      expect(screen.getByTestId('now-playing-wrapper').style.opacity).toBe('1')
    })

    it('never hides the TAP TO UNMUTE button, even after the idle timeout', () => {
      const channel = makeChannel()
      const track = channel.tracks![0]

      widgetOverride.current = {
        widget: null,
        status: 'ready',
        activeChannelId: channel.id,
        isReady: true,
        setActiveChannel: () => {},
      }

      renderInProvider(
        <MusicChannelView
          channel={channel}
          position={makePosition(track)}
          isMuted={true}
          volume={0.5}
          onUnmute={() => {}}
          activePreset="spectrum"
        />,
      )

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(
        screen.getByRole('button', { name: /tap to unmute/i }),
      ).toBeTruthy()
    })

    it('keeps the status badge visible on error even when idle', () => {
      renderWithTrack('error')

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      expect(screen.getByTestId('music-status-badge').style.opacity).toBe('1')
      expect(screen.getByTestId('now-playing-wrapper').style.opacity).toBe('0')
    })
  })

  it('shows radial-gradient fallback backdrop when WebGL2 is unavailable', async () => {
    // Make the renderer constructor throw to simulate a webgl2-unavailable environment.
    MockRenderer.mockImplementationOnce(() => {
      throw new Error('WebGL2 not supported')
    })

    const channel = makeChannel()
    const track = channel.tracks![0]
    const position = makePosition(track)

    const { container } = renderInProvider(
      <MusicChannelView
        channel={channel}
        position={position}
        isMuted={false}
        volume={0.5}
        onUnmute={() => {}}
        activePreset="spectrum"
      />,
    )

    // After the constructor throws, MusicVisualizerCanvas calls onFallback,
    // which sets hasFallback=true and replaces the canvas with a gradient div.
    expect(screen.queryByTestId('music-visualizer-canvas')).toBeNull()
    const fallbackDivs = container.querySelectorAll('[style*="radial-gradient"]')
    expect(fallbackDivs.length).toBeGreaterThan(0)
  })
})
