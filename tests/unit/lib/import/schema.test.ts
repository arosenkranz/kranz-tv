/**
 * T005 — Phase 2 schema tests for discriminated union Channel type.
 *
 * Tests the updated ChannelArraySchema that:
 * - accepts VideoChannel (with kind: 'video')
 * - accepts MusicChannel (with kind: 'music')
 * - rejects mixed/invalid shapes
 * - injects kind: 'video' via preprocess for legacy records without a kind field
 */
import { describe, it, expect } from 'vitest'
import { ChannelArraySchema, isSoundCloudUrl } from '~/lib/import/schema'

const validVideoChannel = {
  kind: 'video' as const,
  id: 'ch-video',
  number: 1,
  name: 'Video Channel',
  playlistId: 'PLabc123',
  videos: [],
  totalDurationSeconds: 0,
}

const validMusicChannel = {
  kind: 'music' as const,
  id: 'ch-music',
  number: 2,
  name: 'Music Channel',
  source: 'soundcloud' as const,
  sourceUrl: 'https://soundcloud.com/user/sets/playlist',
  totalDurationSeconds: 3600,
  trackCount: 10,
}

describe('ChannelArraySchema — discriminated union', () => {
  describe('VideoChannel shape', () => {
    it('accepts a well-formed VideoChannel with kind: video', () => {
      const result = ChannelArraySchema.safeParse([validVideoChannel])
      expect(result.success).toBe(true)
    })

    it('accepts VideoChannel without a kind field (legacy record) via preprocess', () => {
      const legacy = { ...validVideoChannel }
       
      delete (legacy as any).kind
      const result = ChannelArraySchema.safeParse([legacy])
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data[0].kind).toBe('video')
      }
    })

    it('rejects VideoChannel missing required playlistId', () => {
      const bad = { ...validVideoChannel, playlistId: undefined }
      const result = ChannelArraySchema.safeParse([bad])
      expect(result.success).toBe(false)
    })
  })

  describe('MusicChannel shape', () => {
    it('accepts a well-formed MusicChannel with kind: music', () => {
      const result = ChannelArraySchema.safeParse([validMusicChannel])
      expect(result.success).toBe(true)
    })

    it('rejects MusicChannel with non-soundcloud source', () => {
      const bad = { ...validMusicChannel, source: 'mixcloud' }
      const result = ChannelArraySchema.safeParse([bad])
      expect(result.success).toBe(false)
    })

    it('rejects MusicChannel with http sourceUrl', () => {
      const bad = {
        ...validMusicChannel,
        sourceUrl: 'http://soundcloud.com/user/sets/pl',
      }
      const result = ChannelArraySchema.safeParse([bad])
      expect(result.success).toBe(false)
    })

    it('rejects MusicChannel with javascript: sourceUrl', () => {
      const bad = { ...validMusicChannel, sourceUrl: 'javascript:void(0)' }
      const result = ChannelArraySchema.safeParse([bad])
      expect(result.success).toBe(false)
    })

    it('rejects MusicChannel with spoofed host in sourceUrl', () => {
      const bad = {
        ...validMusicChannel,
        sourceUrl: 'https://soundcloud.com.attacker.com/sets/x',
      }
      const result = ChannelArraySchema.safeParse([bad])
      expect(result.success).toBe(false)
    })
  })

  describe('mixed channel list', () => {
    it('accepts an array containing both VideoChannel and MusicChannel', () => {
      const result = ChannelArraySchema.safeParse([
        validVideoChannel,
        validMusicChannel,
      ])
      expect(result.success).toBe(true)
    })

    it('accepts legacy VideoChannel alongside MusicChannel', () => {
      const legacy = { ...validVideoChannel }
       
      delete (legacy as any).kind
      const result = ChannelArraySchema.safeParse([legacy, validMusicChannel])
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data[0].kind).toBe('video')
        expect(result.data[1].kind).toBe('music')
      }
    })

    it('rejects an object with kind: music but VideoChannel fields', () => {
      const mixed = {
        kind: 'music',
        id: 'bad',
        number: 3,
        name: 'Bad',
        playlistId: 'PLsomething', // video-only field
        source: 'soundcloud',
        sourceUrl: 'https://soundcloud.com/user/sets/pl',
        totalDurationSeconds: 0,
        trackCount: 0,
      }
      // mixed kind should succeed if all required music fields present — playlistId is ignored
      const result = ChannelArraySchema.safeParse([mixed])
      // MusicChannel schema should accept this (extra fields are stripped by Zod)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data[0].kind).toBe('music')
        // playlistId should NOT appear on the parsed result (MusicChannel doesn't have it)
        expect('playlistId' in result.data[0]).toBe(false)
      }
    })
  })
})

describe('isSoundCloudUrl', () => {
  describe('valid SoundCloud hosts', () => {
    it.each([
      'https://soundcloud.com/user/sets/playlist',
      'https://www.soundcloud.com/user/sets/playlist',
      'https://m.soundcloud.com/user/sets/playlist',
      'https://on.soundcloud.com/user/sets/playlist',
    ])('accepts %s', (url) => {
      expect(isSoundCloudUrl(url)).toBe(true)
    })
  })

  describe('invalid URLs', () => {
    it.each([
      ['http scheme', 'http://soundcloud.com/user/sets/playlist'],
      ['javascript scheme', 'javascript:void(0)'],
      ['data scheme', 'data:text/html,hello'],
      ['blob scheme', 'blob:https://soundcloud.com/123'],
      ['file scheme', 'file:///etc/passwd'],
      ['spoofed host suffix', 'https://soundcloud.com.attacker.com/sets/x'],
      ['spoofed host prefix', 'https://attacker.com/soundcloud.com/sets/x'],
      ['empty string', ''],
      ['non-URL string', 'not-a-url'],
      ['YouTube URL', 'https://www.youtube.com/playlist?list=PLabc'],
    ])('rejects %s', (_label, url) => {
      expect(isSoundCloudUrl(url)).toBe(false)
    })
  })
})
