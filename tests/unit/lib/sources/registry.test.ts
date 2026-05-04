import { describe, it, expect } from 'vitest'
import { detectSource, sourceFor } from '~/lib/sources/registry'

describe('detectSource', () => {
  it('returns SoundCloud adapter for soundcloud.com URLs', () => {
    const adapter = detectSource('https://soundcloud.com/artist/sets/my-playlist')
    expect(adapter?.id).toBe('soundcloud')
  })

  it('returns SoundCloud adapter for www.soundcloud.com URLs', () => {
    const adapter = detectSource('https://www.soundcloud.com/artist/sets/x')
    expect(adapter?.id).toBe('soundcloud')
  })

  it('returns YouTube adapter for youtube.com playlist URLs', () => {
    const adapter = detectSource(
      'https://www.youtube.com/playlist?list=PLxyz123',
    )
    expect(adapter?.id).toBe('youtube')
  })

  it('returns YouTube adapter for youtu.be playlist URLs', () => {
    const adapter = detectSource(
      'https://youtu.be/dQw4w9WgXcQ?list=PLxyz123',
    )
    expect(adapter?.id).toBe('youtube')
  })

  it('returns null for unknown URLs', () => {
    expect(detectSource('https://example.com/something')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(detectSource('')).toBeNull()
  })

  it('returns YouTube adapter for bare playlist IDs', () => {
    expect(detectSource('PLxyz123')?.id).toBe('youtube')
  })

  it('returns null for non-URL non-ID strings', () => {
    expect(detectSource('not a url or id')).toBeNull()
  })
})

describe('sourceFor', () => {
  it('returns SoundCloud adapter by id', () => {
    expect(sourceFor('soundcloud')?.id).toBe('soundcloud')
  })

  it('returns YouTube adapter by id', () => {
    expect(sourceFor('youtube')?.id).toBe('youtube')
  })

  it('returns null for unknown id', () => {
    expect(sourceFor('mixcloud' as never)).toBeNull()
  })
})
