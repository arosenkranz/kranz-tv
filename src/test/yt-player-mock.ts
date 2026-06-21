import { vi } from 'vitest'

/**
 * Build a fully-typed YT.Player mock with no-op defaults for every member.
 * Callers pass only the members a given test cares about as `overrides`.
 *
 * Shared by youtube-iframe.test.ts and tv-player.test.tsx so the no-op
 * member list lives in exactly one place.
 */
export function mockPlayer(overrides: Partial<YT.Player> = {}): YT.Player {
  return {
    cuePlaylist: vi.fn(),
    cueVideoById: vi.fn(),
    cueVideoByUrl: vi.fn(),
    destroy: vi.fn(),
    getAvailablePlaybackRates: vi.fn(() => []),
    getAvailableQualityLevels: vi.fn(() => []),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 0),
    getIframe: vi.fn(() => document.createElement('iframe')),
    getPlaybackQuality: vi.fn(() => 'default'),
    getPlaybackRate: vi.fn(() => 1),
    getPlayerState: vi.fn(() => -1),
    getPlaylist: vi.fn(() => []),
    getPlaylistIndex: vi.fn(() => 0),
    getSphericalProperties: vi.fn(() => ({})),
    getVideoData: vi.fn(() => ({
      video_id: '',
      author: '',
      title: '',
      video_quality: '',
      video_quality_features: [],
    })),
    getVideoEmbedCode: vi.fn(() => ''),
    getVideoLoadedFraction: vi.fn(() => 0),
    getVideoUrl: vi.fn(() => ''),
    getVolume: vi.fn(() => 0),
    isMuted: vi.fn(() => false),
    loadPlaylist: vi.fn(),
    loadVideoById: vi.fn(),
    loadVideoByUrl: vi.fn(),
    mute: vi.fn(),
    nextVideo: vi.fn(),
    pauseVideo: vi.fn(),
    playVideo: vi.fn(),
    playVideoAt: vi.fn(),
    previousVideo: vi.fn(),
    seekTo: vi.fn(),
    setLoop: vi.fn(),
    setPlaybackQuality: vi.fn(),
    setPlaybackRate: vi.fn(),
    setShuffle: vi.fn(),
    setSize: vi.fn(),
    setSphericalProperties: vi.fn(),
    setVolume: vi.fn(),
    stopVideo: vi.fn(),
    unMute: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  } as unknown as YT.Player
}
