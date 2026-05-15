import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchYouTubePlaylist } from '~/routes/api/youtube'
import { fetchSoundCloudPlaylist } from '~/routes/api/soundcloud'
import { importChannel } from '~/lib/import/import-channel'

// Mock server functions — they run server-side in production but we stub
// them here so unit tests don't make real HTTP calls.
vi.mock('~/routes/api/youtube', () => ({
  fetchYouTubePlaylist: vi.fn(),
  checkYouTubeQuota: vi.fn(),
}))

vi.mock('~/routes/api/soundcloud', () => ({
  fetchSoundCloudPlaylist: vi.fn(),
}))

vi.mock('~/lib/storage/track-db', () => ({
  saveTracks: vi.fn().mockResolvedValue(undefined),
  loadTracks: vi.fn().mockResolvedValue([]),
  deleteTracks: vi.fn().mockResolvedValue(undefined),
}))

const mockFetchYT = vi.mocked(fetchYouTubePlaylist)
const mockFetchSC = vi.mocked(fetchSoundCloudPlaylist)

const MOCK_VIDEOS = [
  { id: 'video1', title: 'Video One', durationSeconds: 100, thumbnailUrl: 'https://img1.jpg' },
  { id: 'video2', title: 'Video Two', durationSeconds: 200, thumbnailUrl: 'https://img2.jpg' },
]

const MOCK_TRACKS = [
  { id: 't1', title: 'Track One', artist: 'Artist A', durationSeconds: 180, embedUrl: 'https://w.soundcloud.com/player/?url=sc/t1' },
  { id: 't2', title: 'Track Two', artist: 'Artist B', durationSeconds: 240, embedUrl: 'https://w.soundcloud.com/player/?url=sc/t2' },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('importChannel — YouTube', () => {
  it('returns error for invalid URL', async () => {
    const result = await importChannel('not-a-url', 'My Channel', 6)
    expect(result.success).toBe(false)
  })

  it('returns error when playlist is empty', async () => {
    mockFetchYT.mockResolvedValue([])
    const result = await importChannel(
      'https://www.youtube.com/playlist?list=PLxyz123',
      'My Channel',
      6,
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/empty/i)
  })

  it('builds a channel on success', async () => {
    mockFetchYT.mockResolvedValue(MOCK_VIDEOS)
    const result = await importChannel(
      'https://www.youtube.com/playlist?list=PLxyz123',
      'My Channel',
      6,
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
    mockFetchYT.mockResolvedValue([MOCK_VIDEOS[0]])
    const result = await importChannel(
      'https://www.youtube.com/playlist?list=PLxyz123',
      'My Awesome Channel!',
      7,
    )
    expect(result.success).toBe(true)
    if (result.success) expect(result.channel.id).toBe('my-awesome-channel')
  })

  it('returns quota error message on QUOTA_EXCEEDED', async () => {
    mockFetchYT.mockRejectedValue(new Error('QUOTA_EXCEEDED'))
    const result = await importChannel(
      'https://www.youtube.com/playlist?list=PLxyz123',
      'My Channel',
      6,
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/technical difficulties/i)
  })

  it('wraps generic API errors', async () => {
    mockFetchYT.mockRejectedValue(new Error('Network failure'))
    const result = await importChannel(
      'https://www.youtube.com/playlist?list=PLxyz123',
      'My Channel',
      6,
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeTruthy()
  })
})

describe('importChannel — SoundCloud', () => {
  it('imports a SoundCloud playlist successfully', async () => {
    mockFetchSC.mockResolvedValue({ title: 'My Playlist', tracks: MOCK_TRACKS, totalDurationSeconds: 420 })
    const result = await importChannel(
      'https://soundcloud.com/artist/sets/my-playlist',
      'Chill Beats',
      7,
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

  it('returns not-found error for private or deleted playlists', async () => {
    mockFetchSC.mockRejectedValue(new Error('PLAYLIST_NOT_FOUND'))
    const result = await importChannel(
      'https://soundcloud.com/artist/sets/private',
      'Private',
      7,
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/not found/i)
  })

  it('wraps generic SC errors', async () => {
    mockFetchSC.mockRejectedValue(new Error('Network failure'))
    const result = await importChannel(
      'https://soundcloud.com/artist/sets/my-playlist',
      'Chill Beats',
      7,
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeTruthy()
  })
})
