import { describe, it, expect } from 'vitest'
import { extractPlaylistId } from '~/lib/import/parser'

describe('extractPlaylistId', () => {
  describe('canonical YouTube playlist URLs', () => {
    it('handles www.youtube.com/playlist?list=', () => {
      expect(
        extractPlaylistId('https://www.youtube.com/playlist?list=PLxyz123'),
      ).toBe('PLxyz123')
    })

    it('handles youtube.com without www', () => {
      expect(
        extractPlaylistId('https://youtube.com/playlist?list=PLxyz123'),
      ).toBe('PLxyz123')
    })

    it('handles m.youtube.com (mobile)', () => {
      expect(
        extractPlaylistId('https://m.youtube.com/playlist?list=PLxyz123'),
      ).toBe('PLxyz123')
    })

    it('handles http without https', () => {
      expect(
        extractPlaylistId('http://www.youtube.com/playlist?list=PLxyz123'),
      ).toBe('PLxyz123')
    })
  })

  describe('video-in-playlist URLs', () => {
    it('extracts list param from watch?v=...&list=...', () => {
      expect(
        extractPlaylistId(
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxyz123',
        ),
      ).toBe('PLxyz123')
    })

    it('handles list param before v param', () => {
      expect(
        extractPlaylistId(
          'https://www.youtube.com/watch?list=PLxyz123&v=dQw4w9WgXcQ',
        ),
      ).toBe('PLxyz123')
    })
  })

  describe('short URLs', () => {
    it('handles youtu.be short URL with list param', () => {
      expect(
        extractPlaylistId('https://youtu.be/dQw4w9WgXcQ?list=PLxyz123'),
      ).toBe('PLxyz123')
    })
  })

  describe('bare playlist IDs', () => {
    it('accepts bare PL-prefixed ID', () => {
      expect(extractPlaylistId('PLmDOmgjgiHsiBYTWTmljl4E3Ft0DBVlDH')).toBe(
        'PLmDOmgjgiHsiBYTWTmljl4E3Ft0DBVlDH',
      )
    })

    it('accepts UU-prefixed ID', () => {
      expect(extractPlaylistId('UUaBcDeFgHiJkLmNoPqRsTuV')).toBe(
        'UUaBcDeFgHiJkLmNoPqRsTuV',
      )
    })

    it('accepts FL-prefixed ID', () => {
      expect(extractPlaylistId('FLRbSMOWF7L-IrYVrZ0qBRfw')).toBe(
        'FLRbSMOWF7L-IrYVrZ0qBRfw',
      )
    })

    it('accepts RD-prefixed ID', () => {
      expect(extractPlaylistId('RDxyz123abc')).toBe('RDxyz123abc')
    })
  })

  describe('invalid inputs', () => {
    it('returns null for empty string', () => {
      expect(extractPlaylistId('')).toBeNull()
    })

    it('returns null for a plain video URL (no list param)', () => {
      expect(
        extractPlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      ).toBeNull()
    })

    it('returns null for a non-YouTube URL', () => {
      expect(extractPlaylistId('https://vimeo.com/playlist/123')).toBeNull()
    })

    it('returns null for random text', () => {
      expect(extractPlaylistId('not a url at all')).toBeNull()
    })

    it('returns null for a bare video ID (no PL/UU/FL/OL/LL/RD prefix)', () => {
      expect(extractPlaylistId('dQw4w9WgXcQ')).toBeNull()
    })
  })
})
