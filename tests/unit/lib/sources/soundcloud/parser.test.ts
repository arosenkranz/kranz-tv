import { describe, it, expect } from 'vitest'
import { isSoundCloudUrl, normalizeSoundCloudUrl } from '~/lib/sources/soundcloud/parser'

describe('isSoundCloudUrl', () => {
  it.each([
    'https://soundcloud.com/artist/sets/my-playlist',
    'https://www.soundcloud.com/artist/sets/my-playlist',
    'https://m.soundcloud.com/artist/sets/my-playlist',
    'https://on.soundcloud.com/AbCdEfGhI',
  ])('accepts valid SoundCloud URL: %s', (url) => {
    expect(isSoundCloudUrl(url)).toBe(true)
  })

  it.each([
    'http://soundcloud.com/artist/sets/x',
    'https://soundcloud.com.attacker.com/sets/x',
    'https://attacker.com/soundcloud.com',
    'javascript:void(0)',
    'data:text/html,<script>alert(1)</script>',
    'blob:https://soundcloud.com/abc',
    'file:///etc/passwd',
    'https://mixcloud.com/artist/show',
    'https://notsoundcloud.com/sets/x',
    '',
    'not-a-url-at-all',
  ])('rejects non-SoundCloud URL: %s', (url) => {
    expect(isSoundCloudUrl(url)).toBe(false)
  })

  it('rejects http (non-https) SoundCloud URL', () => {
    expect(isSoundCloudUrl('http://soundcloud.com/sets/x')).toBe(false)
  })

  it('rejects subdomain that starts with soundcloud.com', () => {
    expect(isSoundCloudUrl('https://xsoundcloud.com/sets/x')).toBe(false)
  })
})

describe('normalizeSoundCloudUrl', () => {
  it('strips trailing slash', () => {
    expect(normalizeSoundCloudUrl('https://soundcloud.com/artist/sets/x/')).toBe(
      'https://soundcloud.com/artist/sets/x',
    )
  })

  it('strips query params and hash', () => {
    expect(
      normalizeSoundCloudUrl('https://soundcloud.com/artist/sets/x?si=abc#ref'),
    ).toBe('https://soundcloud.com/artist/sets/x')
  })

  it('normalizes www. to bare domain', () => {
    expect(normalizeSoundCloudUrl('https://www.soundcloud.com/artist/sets/x')).toBe(
      'https://soundcloud.com/artist/sets/x',
    )
  })

  it('returns the URL unchanged if already normalized', () => {
    const url = 'https://soundcloud.com/artist/sets/my-playlist'
    expect(normalizeSoundCloudUrl(url)).toBe(url)
  })
})
