import { describe, it, expect } from 'vitest'
import { YouTubeQuotaError } from '../../../src/lib/channels/youtube-api.ts'

describe('YouTubeQuotaError', () => {
  it('is an instance of Error', () => {
    expect(new YouTubeQuotaError()).toBeInstanceOf(Error)
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
