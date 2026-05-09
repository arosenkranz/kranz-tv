import { describe, it, expect } from 'vitest'
import { buildShareUrl, parseShareUrl } from '~/lib/shares/share-url'

describe('buildShareUrl', () => {
  it('produces an absolute URL of the form `<origin>/s/<shareId>`', () => {
    expect(buildShareUrl('ABCDEFGH', 'https://kranz.tv')).toBe(
      'https://kranz.tv/s/ABCDEFGH',
    )
  })

  it('strips a trailing slash from the origin', () => {
    expect(buildShareUrl('ABCDEFGH', 'https://kranz.tv/')).toBe(
      'https://kranz.tv/s/ABCDEFGH',
    )
  })

  it('uppercases the share-id before embedding (canonical form)', () => {
    expect(buildShareUrl('abcdefgh', 'https://kranz.tv')).toBe(
      'https://kranz.tv/s/ABCDEFGH',
    )
  })

  it('falls back to window.location.origin when origin is omitted', () => {
    // jsdom default: http://localhost:3000
    const url = buildShareUrl('ABCDEFGH')
    expect(url.endsWith('/s/ABCDEFGH')).toBe(true)
    expect(url.startsWith('http')).toBe(true)
  })

  it('throws or returns a clearly-marked error string on invalid share-id', () => {
    // Caller passes through validation; build itself only formats. But we
    // do guard against empty / whitespace inputs so we don't emit a broken URL.
    expect(() => buildShareUrl('', 'https://kranz.tv')).toThrow()
    expect(() => buildShareUrl('   ', 'https://kranz.tv')).toThrow()
  })
})

describe('parseShareUrl', () => {
  it('extracts the share-id from a full URL', () => {
    expect(parseShareUrl('https://kranz.tv/s/ABCDEFGH')).toBe('ABCDEFGH')
  })

  it('extracts the share-id from a bare path', () => {
    expect(parseShareUrl('/s/ABCDEFGH')).toBe('ABCDEFGH')
  })

  it('normalizes lowercase share-id to canonical uppercase', () => {
    expect(parseShareUrl('/s/abcdefgh')).toBe('ABCDEFGH')
  })

  it('handles trailing slash on path', () => {
    expect(parseShareUrl('/s/ABCDEFGH/')).toBe('ABCDEFGH')
  })

  it('handles query-string suffix (strips it)', () => {
    expect(parseShareUrl('/s/ABCDEFGH?utm_source=x')).toBe('ABCDEFGH')
  })

  it('returns null for paths that are not /s/<id>', () => {
    expect(parseShareUrl('/channel/ABCDEFGH')).toBeNull()
    expect(parseShareUrl('/')).toBeNull()
    expect(parseShareUrl('/s/')).toBeNull()
  })

  it('returns null when the share-id is malformed', () => {
    // '!' is not in Crockford alphabet
    expect(parseShareUrl('/s/!@#$%^&*')).toBeNull()
    // wrong length
    expect(parseShareUrl('/s/SHORT')).toBeNull()
    expect(parseShareUrl('/s/TOOLONG12')).toBeNull()
  })

  it('returns null on garbage input', () => {
    expect(parseShareUrl('')).toBeNull()
    expect(parseShareUrl('not-a-path')).toBeNull()
    expect(parseShareUrl(null as unknown as string)).toBeNull()
  })
})
