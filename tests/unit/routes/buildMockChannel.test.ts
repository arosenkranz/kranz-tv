import { describe, it, expect } from 'vitest'
import { buildMockChannel } from '~/routes/_tv.channel.$channelId'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'

// `buildMockChannel` is the fallback used when YouTube API is unavailable
// or when the live import (YT playlist fetch / SC iframe import) fails.
// It must produce a channel of the matching kind so that the wrong
// player surface (TvPlayer vs MusicChannelView) doesn't render.

describe('buildMockChannel', () => {
  describe('music presets', () => {
    const musicPreset = CHANNEL_PRESETS.find((p) => p.kind === 'music')

    it('returns a music-shaped stub for music presets', () => {
      if (musicPreset === undefined) throw new Error('no music preset to test')
      const ch = buildMockChannel(musicPreset.id)
      expect(ch.kind).toBe('music')
      // Discriminate so TS narrows for the assertions below.
      if (ch.kind !== 'music') return
      expect(ch.id).toBe(musicPreset.id)
      expect(ch.number).toBe(musicPreset.number)
      expect(ch.name).toBe(musicPreset.name)
      expect(ch.source).toBe('soundcloud')
      expect(ch.sourceUrl).toBe(musicPreset.sourceUrl)
      expect(ch.tracks).toEqual([])
      expect(ch.trackCount).toBe(0)
      expect(ch.totalDurationSeconds).toBe(0)
    })

    it('does NOT return a YouTube video mock for music channels', () => {
      // Pre-fix regression test: the old fallback returned a YT video mock
      // (Gangnam Style) for any channelId, including music presets, which
      // caused the wrong player to mount on a music channel page.
      if (musicPreset === undefined) throw new Error('no music preset to test')
      const ch = buildMockChannel(musicPreset.id)
      expect(ch).not.toHaveProperty('videos')
      expect(ch).not.toHaveProperty('playlistId')
    })
  })

  describe('video presets', () => {
    const videoPreset = CHANNEL_PRESETS.find((p) => p.kind === 'video')

    it('returns a YouTube-shaped mock for video presets', () => {
      if (videoPreset === undefined) throw new Error('no video preset to test')
      const ch = buildMockChannel(videoPreset.id)
      expect(ch.kind).toBe('video')
      if (ch.kind !== 'video') return
      expect(ch.id).toBe(videoPreset.id)
      expect(ch.number).toBe(videoPreset.number)
      expect(ch.name).toBe(videoPreset.name)
      expect(ch.videos.length).toBe(3)
      expect(ch.videos[0]?.id).toBe('dQw4w9WgXcQ') // Rick Astley
    })
  })

  describe('unknown channelId (no matching preset)', () => {
    it('returns a YouTube-shaped fallback with placeholder name', () => {
      const ch = buildMockChannel('does-not-exist-12345')
      expect(ch.kind).toBe('video')
      if (ch.kind !== 'video') return
      expect(ch.id).toBe('does-not-exist-12345')
      expect(ch.name).toBe('Channel')
      expect(ch.number).toBe(1)
      expect(ch.videos.length).toBe(3)
    })
  })
})
