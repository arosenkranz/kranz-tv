import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type {
  MusicChannel,
  SchedulePosition,
  Track,
} from '~/lib/scheduling/types'
import { MusicChannelView } from '~/components/music-channel-view'
import { ScWidgetProvider } from '~/lib/sources/soundcloud/sc-widget-context'

const { MockRenderer } = vi.hoisted(() => {
  const instance = {
    setPreset: () => {},
    start: () => {},
    setTrackPosition: () => {},
    dispose: () => {},
  }
  return { MockRenderer: vi.fn(() => instance) }
})

vi.mock('~/lib/visualizers/renderer', () => ({
  VisualizerRenderer: MockRenderer,
}))

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
  vi.restoreAllMocks()
})

function renderInProvider(ui: React.ReactElement) {
  return render(<ScWidgetProvider>{ui}</ScWidgetProvider>)
}

describe('MusicChannelView', () => {
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
