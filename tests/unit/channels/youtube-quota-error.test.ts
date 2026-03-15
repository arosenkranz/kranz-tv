import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  YouTubeQuotaError,
  fetchPlaylistVideoIds,
  fetchVideoDetails,
} from '../../../src/lib/channels/youtube-api.ts'

// ---------------------------------------------------------------------------
// YouTubeQuotaError class
// ---------------------------------------------------------------------------

describe('YouTubeQuotaError', () => {
  it('is an instance of Error', () => {
    const err = new YouTubeQuotaError()
    expect(err).toBeInstanceOf(Error)
  })

  it('has name "YouTubeQuotaError"', () => {
    expect(new YouTubeQuotaError().name).toBe('YouTubeQuotaError')
  })

  it('has expected message', () => {
    expect(new YouTubeQuotaError().message).toBe('YouTube API quota exceeded')
  })

  it('can be detected with instanceof', () => {
    try {
      throw new YouTubeQuotaError()
    } catch (e) {
      expect(e instanceof YouTubeQuotaError).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// fetchPlaylistVideoIds — quota error detection
// ---------------------------------------------------------------------------

describe('fetchPlaylistVideoIds quota detection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws YouTubeQuotaError on 403 with quotaExceeded reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        clone: () => ({
          json: async () => ({
            error: {
              errors: [{ reason: 'quotaExceeded' }],
            },
          }),
        }),
        text: async () => 'Quota exceeded',
      }),
    )

    await expect(
      fetchPlaylistVideoIds('PLtest', 'fake-key'),
    ).rejects.toBeInstanceOf(YouTubeQuotaError)
  })

  it('throws YouTubeQuotaError on 403 with rateLimitExceeded reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        clone: () => ({
          json: async () => ({
            error: {
              errors: [{ reason: 'rateLimitExceeded' }],
            },
          }),
        }),
        text: async () => 'Rate limited',
      }),
    )

    await expect(
      fetchPlaylistVideoIds('PLtest', 'fake-key'),
    ).rejects.toBeInstanceOf(YouTubeQuotaError)
  })

  it('throws generic Error on 403 without quota reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        clone: () => ({
          json: async () => ({
            error: {
              errors: [{ reason: 'keyInvalid' }],
            },
          }),
        }),
        text: async () => 'Invalid key',
      }),
    )

    const err = await fetchPlaylistVideoIds('PLtest', 'bad-key').catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(YouTubeQuotaError)
  })

  it('throws generic Error on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        clone: () => ({ json: async () => ({}) }),
        text: async () => 'Not found',
      }),
    )

    const err = await fetchPlaylistVideoIds('PLtest', 'key').catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(YouTubeQuotaError)
  })
})

// ---------------------------------------------------------------------------
// fetchVideoDetails — quota error detection
// ---------------------------------------------------------------------------

describe('fetchVideoDetails quota detection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws YouTubeQuotaError on 403 with quotaExceeded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        clone: () => ({
          json: async () => ({
            error: { errors: [{ reason: 'quotaExceeded' }] },
          }),
        }),
        text: async () => 'Quota exceeded',
      }),
    )

    await expect(
      fetchVideoDetails(['vid1'], 'fake-key'),
    ).rejects.toBeInstanceOf(YouTubeQuotaError)
  })
})
