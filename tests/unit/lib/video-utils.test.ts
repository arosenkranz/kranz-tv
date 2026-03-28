import { describe, it, expect } from 'vitest'
import { getThumbnailUrl } from '~/lib/video-utils'
import type { Video } from '~/lib/scheduling/types'

const makeVideo = (overrides: Partial<Video> = {}): Video => ({
  id: 'dQw4w9WgXcQ',
  title: 'Test Video',
  durationSeconds: 212,
  thumbnailUrl: '',
  ...overrides,
})

describe('getThumbnailUrl', () => {
  it('returns thumbnailUrl when present', () => {
    const video = makeVideo({
      thumbnailUrl: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
    })
    expect(getThumbnailUrl(video)).toBe(
      'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
    )
  })

  it('returns YouTube fallback when thumbnailUrl is empty', () => {
    const video = makeVideo({ id: 'dQw4w9WgXcQ', thumbnailUrl: '' })
    expect(getThumbnailUrl(video)).toBe(
      'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    )
  })
})
