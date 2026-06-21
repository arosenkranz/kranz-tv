import { describe, it, expect } from 'vitest'
import { FetchPlaylistInput } from '~/routes/api/soundcloud'

describe('FetchPlaylistInput', () => {
  it('accepts a valid https SoundCloud playlist URL', () => {
    const r = FetchPlaylistInput.safeParse({
      url: 'https://soundcloud.com/user/sets/mix',
    })
    expect(r.success).toBe(true)
  })

  it('rejects a non-SoundCloud host (SSRF guard)', () => {
    const r = FetchPlaylistInput.safeParse({
      url: 'http://169.254.169.254/latest/meta-data/',
    })
    expect(r.success).toBe(false)
  })

  it('rejects http (non-https) SoundCloud URLs', () => {
    const r = FetchPlaylistInput.safeParse({
      url: 'http://soundcloud.com/user/sets/mix',
    })
    expect(r.success).toBe(false)
  })

  it('rejects a look-alike host (allowlist-bypass guard)', () => {
    const r = FetchPlaylistInput.safeParse({
      url: 'https://soundcloud.com.evil.com/user/sets/mix',
    })
    expect(r.success).toBe(false)
  })

  it('rejects a bare non-URL string', () => {
    const r = FetchPlaylistInput.safeParse({ url: 'not a url' })
    expect(r.success).toBe(false)
  })
})
