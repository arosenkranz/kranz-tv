import { describe, it, expect, vi, beforeEach } from 'vitest'
import { importChannel } from '~/lib/import/import-channel'

import {
  fetchPlaylistVideoIds,
  fetchVideoDetails,
} from '~/lib/channels/youtube-api'

// Mock the YouTube API module — must include YouTubeQuotaError so import-channel.ts
// can use instanceof checks against it without the class being undefined
vi.mock('~/lib/channels/youtube-api', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('~/lib/channels/youtube-api')>()
  return {
    ...original,
    fetchPlaylistVideoIds: vi.fn(),
    fetchVideoDetails: vi.fn(),
  }
})

// Mock SoundCloud adapter so tests don't need a real browser/iframe
vi.mock('~/lib/sources/soundcloud/adapter', () => ({
  SoundCloudAdapter: {
    id: 'soundcloud',
    displayName: 'SoundCloud',
    matchesUrl: (url: string) => url.startsWith('https://soundcloud.com'),
    importPlaylist: vi.fn(),
  },
}))

// Mock track-db so IndexedDB calls succeed in happy-dom
vi.mock('~/lib/storage/track-db', () => ({
  saveTracks: vi.fn().mockResolvedValue(undefined),
  loadTracks: vi.fn().mockResolvedValue([]),
  deleteTracks: vi.fn().mockResolvedValue(undefined),
}))

const mockFetchPlaylistVideoIds = vi.mocked(fetchPlaylistVideoIds)
const mockFetchVideoDetails = vi.mocked(fetchVideoDetails)

const MOCK_VIDEOS = [
  {
    id: 'video1',
    title: 'Video One',
    durationSeconds: 100,
    thumbnailUrl: 'https://img1.jpg',
  },
  {
    id: 'video2',
    title: 'Video Two',
    durationSeconds: 200,
    thumbnailUrl: 'https://img2.jpg',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('importChannel', () => {
  it('returns error when no API key provided', async () => {
    const result = await importChannel(
      'https://www.youtube.com/playlist?list=PLxyz123',
      'My Channel',
      6,
      '',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/api key/i)
    }
  })

  it('returns error for invalid URL', async () => {
    const result = await importChannel(
      'not-a-url',
      'My Channel',
      6,
      'fake-api-key',
    )
    expect(result.success).toBe(false)
  })

  it('returns error when playlist is empty', async () => {
    mockFetchPlaylistVideoIds.mockResolvedValue([])
    mockFetchVideoDetails.mockResolvedValue([])

    const result = await importChannel(
      'https://www.youtube.com/playlist?list=PLxyz123',
      'My Channel',
      6,
      'fake-api-key',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/empty/i)
    }
  })

  it('builds a channel on success', async () => {
    mockFetchPlaylistVideoIds.mockResolvedValue(['video1', 'video2'])
    mockFetchVideoDetails.mockResolvedValue(MOCK_VIDEOS)

    const result = await importChannel(
      'https://www.youtube.com/playlist?list=PLxyz123',
      'My Channel',
      6,
      'fake-api-key',
    )
    expect(result.success).toBe(true)
    if (result.success && result.channel.kind === 'video') {
      expect(result.channel.name).toBe('My Channel')
      expect(result.channel.number).toBe(6)
      expect(result.channel.videos).toHaveLength(2)
      expect(result.channel.totalDurationSeconds).toBe(300)
      expect(result.channel.playlistId).toBe('PLxyz123')
    }
  })

  it('slugifies the channel name for the id', async () => {
    mockFetchPlaylistVideoIds.mockResolvedValue(['video1'])
    mockFetchVideoDetails.mockResolvedValue([MOCK_VIDEOS[0]])

    const result = await importChannel(
      'https://www.youtube.com/playlist?list=PLxyz123',
      'My Awesome Channel!',
      7,
      'fake-api-key',
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.channel.id).toBe('my-awesome-channel')
    }
  })

  it('restores playlist order when videos are returned out of order', async () => {
    mockFetchPlaylistVideoIds.mockResolvedValue(['video2', 'video1'])
    // fetchVideoDetails returns them in reverse order
    mockFetchVideoDetails.mockResolvedValue([MOCK_VIDEOS[0], MOCK_VIDEOS[1]])

    const result = await importChannel(
      'https://www.youtube.com/playlist?list=PLxyz123',
      'Test',
      6,
      'fake-api-key',
    )
    expect(result.success).toBe(true)
    if (result.success && result.channel.kind === 'video') {
      // video2 should come first since fetchPlaylistVideoIds returned it first
      expect(result.channel.videos[0]?.id).toBe('video2')
      expect(result.channel.videos[1]?.id).toBe('video1')
    }
  })

  it('wraps API errors with user-friendly message', async () => {
    mockFetchPlaylistVideoIds.mockRejectedValue(
      new Error('YouTube API error 403'),
    )

    const result = await importChannel(
      'https://www.youtube.com/playlist?list=PLxyz123',
      'My Channel',
      6,
      'fake-api-key',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeTruthy()
    }
  })
})

describe('importChannel — SoundCloud', () => {
  // Access the mock via the module registry — vi.mock hoists the mock definition
  // so we can import it synchronously here after vi.mock() has run.
  let mockImport: ReturnType<typeof vi.fn>

  const MOCK_TRACKS = [
    { id: 't1', title: 'Track One', artist: 'Artist A', durationSeconds: 180, embedUrl: 'https://w.soundcloud.com/player/?url=sc/t1' },
    { id: 't2', title: 'Track Two', artist: 'Artist B', durationSeconds: 240, embedUrl: 'https://w.soundcloud.com/player/?url=sc/t2' },
  ]

  beforeEach(async () => {
    const { SoundCloudAdapter } = await import('~/lib/sources/soundcloud/adapter')
    mockImport = vi.mocked(SoundCloudAdapter.importPlaylist)
    mockImport.mockReset()
  })

  it('imports a SoundCloud playlist successfully', async () => {
    mockImport.mockResolvedValue({
      title: 'My Playlist',
      tracks: MOCK_TRACKS,
      totalDurationSeconds: 420,
    })

    const result = await importChannel(
      'https://soundcloud.com/artist/sets/my-playlist',
      'Chill Beats',
      7,
      '',
    )
    expect(result.success).toBe(true)
    if (result.success && result.channel.kind === 'music') {
      expect(result.channel.name).toBe('Chill Beats')
      expect(result.channel.number).toBe(7)
      expect(result.channel.trackCount).toBe(2)
      expect(result.channel.totalDurationSeconds).toBe(420)
      expect(result.channel.source).toBe('soundcloud')
    }
  })

  it('returns timeout error when import times out', async () => {
    mockImport.mockRejectedValue(new Error('TIMEOUT'))

    const result = await importChannel(
      'https://soundcloud.com/artist/sets/slow',
      'Slow Channel',
      7,
      '',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/timed out/i)
    }
  })

  it('returns track-limit error for large playlists', async () => {
    mockImport.mockRejectedValue(new Error('EXCEEDS_TRACK_LIMIT'))

    const result = await importChannel(
      'https://soundcloud.com/artist/sets/big',
      'Big Playlist',
      7,
      '',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/50-track limit/i)
    }
  })

  it('returns not-found error for private or deleted playlists', async () => {
    mockImport.mockRejectedValue(new Error('PLAYLIST_NOT_FOUND'))

    const result = await importChannel(
      'https://soundcloud.com/artist/sets/private',
      'Private',
      7,
      '',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toMatch(/not found/i)
    }
  })
})
