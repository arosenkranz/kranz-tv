import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { MobilePlayerArea } from '~/components/mobile/mobile-player-area'
import type {
  Channel,
  MusicChannel,
  VideoChannel,
  SchedulePosition,
  Track,
  Video,
} from '~/lib/scheduling/types'

// Prevent WebGL construction errors in happy-dom
vi.mock('~/lib/visualizers/renderer', () => ({
  VisualizerRenderer: vi.fn(() => ({
    setPreset: () => {},
    start: () => {},
    setTrackPosition: () => {},
    dispose: () => {},
  })),
}))

// Prevent SoundCloud iframe injection in tests
vi.mock('~/lib/sources/soundcloud/sc-widget-context', () => ({
  ScWidgetProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useScWidget: () => ({
    isReady: false,
    play: () => {},
    pause: () => {},
    seekTo: () => {},
    getPosition: () => Promise.resolve(0),
  }),
}))

// Prevent YouTube player injection in tests
vi.mock('~/components/tv-player', () => ({
  TvPlayer: () => <div data-testid="tv-player" />,
}))

vi.mock('~/components/overlay-canvas', () => ({
  OverlayCanvas: () => null,
}))

vi.mock('~/components/music-channel-view', () => ({
  MusicChannelView: ({ channel }: { channel: MusicChannel }) => (
    <div data-testid="music-channel-view" data-channel-id={channel.id} />
  ),
}))

const makeTrack = (): Track => ({
  id: 'track-1',
  title: 'Test Track',
  artist: 'Test Artist',
  durationSeconds: 180,
  embedUrl: 'https://w.soundcloud.com/player/?url=sc/track-1',
})

const makeMusicChannel = (): MusicChannel => ({
  kind: 'music',
  id: 'music-ch',
  number: 5,
  name: 'Music Channel',
  source: 'soundcloud',
  sourceUrl: 'https://soundcloud.com/artist/sets/playlist',
  totalDurationSeconds: 3600,
  trackCount: 20,
  tracks: [makeTrack()],
})

const makeVideoChannel = (): VideoChannel => ({
  kind: 'video',
  id: 'video-ch',
  number: 2,
  name: 'Video Channel',
  playlistId: 'PLtest',
  videos: [
    {
      id: 'vid-1',
      title: 'Test Video',
      durationSeconds: 300,
      thumbnailUrl: 'https://img.youtube.com/vi/vid-1/hqdefault.jpg',
    },
  ],
  totalDurationSeconds: 300,
})

const makeMusicPosition = (): SchedulePosition => ({
  item: makeTrack(),
  seekSeconds: 30,
  slotStartTime: new Date(),
  slotEndTime: new Date(Date.now() + 150_000),
})

const makeVideoPosition = (): SchedulePosition => ({
  item: {
    id: 'vid-1',
    title: 'Test Video',
    durationSeconds: 300,
    thumbnailUrl: 'https://img.youtube.com/vi/vid-1/hqdefault.jpg',
  } as Video,
  seekSeconds: 0,
  slotStartTime: new Date(),
  slotEndTime: new Date(Date.now() + 300_000),
})

const defaultProps = {
  isMuted: false,
  volume: 1,
  isPlaying: true,
  onPlay: () => {},
  onResync: () => {},
  showStatic: false,
  overlayMode: 'none' as const,
  fillHeight: false,
}

describe('MobilePlayerArea — music channel (US3 crash regression)', () => {
  it('renders MusicChannelView for music channels without calling getThumbnailUrl', () => {
    // This test guards against the crash: getThumbnailUrl(position.item as Video)
    // was called unconditionally, but Track has no thumbnailUrl property.
    render(
      <MobilePlayerArea
        {...defaultProps}
        channel={makeMusicChannel() as Channel}
        position={makeMusicPosition()}
      />,
    )
    expect(screen.getByTestId('music-channel-view')).toBeTruthy()
    expect(screen.queryByTestId('tv-player')).toBeNull()
  })

  it('passes channel id through to MusicChannelView', () => {
    render(
      <MobilePlayerArea
        {...defaultProps}
        channel={makeMusicChannel() as Channel}
        position={makeMusicPosition()}
      />,
    )
    expect(
      screen.getByTestId('music-channel-view').getAttribute('data-channel-id'),
    ).toBe('music-ch')
  })
})

describe('MobilePlayerArea — video channel', () => {
  it('renders TvPlayer (not MusicChannelView) for video channels when playing', () => {
    render(
      <MobilePlayerArea
        {...defaultProps}
        channel={makeVideoChannel() as Channel}
        position={makeVideoPosition()}
        isPlaying={true}
      />,
    )
    expect(screen.getByTestId('tv-player')).toBeTruthy()
    expect(screen.queryByTestId('music-channel-view')).toBeNull()
  })

  it('renders thumbnail poster when not playing (TvPlayer pre-mounted but hidden)', () => {
    render(
      <MobilePlayerArea
        {...defaultProps}
        channel={makeVideoChannel() as Channel}
        position={makeVideoPosition()}
        isPlaying={false}
      />,
    )
    const img = screen.getByRole('img')
    expect(img.getAttribute('src')).toContain('vid-1')
    // TvPlayer is pre-mounted so a single tap can call playVideo() synchronously
    // in the poster button handler — satisfying browser autoplay in one tap.
    expect(screen.getByTestId('tv-player')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })
})
