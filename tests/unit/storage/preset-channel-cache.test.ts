import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  loadCachedChannel,
  saveCachedChannel,
  clearPresetChannelCache,
} from '~/lib/storage/preset-channel-cache'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import type { Channel } from '~/lib/scheduling/types'

const makeChannel = (id: string): Channel => ({
  id,
  number: 1,
  name: 'Test Channel',
  playlistId: 'PL123',
  videos: [
    { id: 'vid1', title: 'Video 1', durationSeconds: 60, thumbnailUrl: '' },
  ],
  totalDurationSeconds: 60,
})

describe('preset-channel-cache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  // ── loadCachedChannel ───────────────────────────────────────────────────────

  describe('loadCachedChannel', () => {
    it('returns null when key is absent', () => {
      expect(loadCachedChannel('skate')).toBeNull()
    })

    it('returns the channel when within TTL', () => {
      const channel = makeChannel('skate')
      saveCachedChannel(channel)
      const result = loadCachedChannel('skate')
      expect(result).toEqual(channel)
    })

    it('returns null and removes key when TTL has expired', () => {
      const channel = makeChannel('skate')
      saveCachedChannel(channel)

      // Advance time past 24 hours
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1)

      expect(loadCachedChannel('skate')).toBeNull()
      expect(localStorage.getItem('kranz-tv:channel-cache:skate')).toBeNull()
    })

    it('returns null on malformed JSON without throwing', () => {
      localStorage.setItem('kranz-tv:channel-cache:skate', '{invalid json}')
      expect(() => loadCachedChannel('skate')).not.toThrow()
      expect(loadCachedChannel('skate')).toBeNull()
    })

    it('returns null and removes key when entry is missing required fields', () => {
      localStorage.setItem(
        'kranz-tv:channel-cache:skate',
        JSON.stringify({ channel: makeChannel('skate') }),
        // missing cachedAt
      )
      expect(loadCachedChannel('skate')).toBeNull()
      expect(localStorage.getItem('kranz-tv:channel-cache:skate')).toBeNull()
    })

    it('returns null (SSR guard) when window is undefined', () => {
      const originalWindow = globalThis.window
      // @ts-expect-error — simulate SSR
      delete globalThis.window
      try {
        expect(loadCachedChannel('skate')).toBeNull()
      } finally {
        globalThis.window = originalWindow
      }
    })
  })

  // ── saveCachedChannel ───────────────────────────────────────────────────────

  describe('saveCachedChannel', () => {
    it('persists a channel that can be read back', () => {
      const channel = makeChannel('music')
      saveCachedChannel(channel)
      expect(loadCachedChannel('music')).toEqual(channel)
    })

    it('does not throw on QuotaExceededError', () => {
      const error = new DOMException('QuotaExceededError', 'QuotaExceededError')
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw error
      })
      expect(() => saveCachedChannel(makeChannel('party'))).not.toThrow()
      spy.mockRestore()
    })

    it('is a no-op (SSR guard) when window is undefined', () => {
      const originalWindow = globalThis.window
      // @ts-expect-error — simulate SSR
      delete globalThis.window
      try {
        expect(() => saveCachedChannel(makeChannel('skate'))).not.toThrow()
      } finally {
        globalThis.window = originalWindow
      }
    })
  })

  // ── clearPresetChannelCache ─────────────────────────────────────────────────

  describe('clearPresetChannelCache', () => {
    it('removes all 6 preset channel keys', () => {
      for (const preset of CHANNEL_PRESETS) {
        saveCachedChannel(makeChannel(preset.id))
      }
      // Verify they were saved
      for (const preset of CHANNEL_PRESETS) {
        expect(localStorage.getItem(`kranz-tv:channel-cache:${preset.id}`)).not.toBeNull()
      }

      clearPresetChannelCache()

      for (const preset of CHANNEL_PRESETS) {
        expect(localStorage.getItem(`kranz-tv:channel-cache:${preset.id}`)).toBeNull()
      }
    })

    it('leaves non-preset keys untouched', () => {
      localStorage.setItem('kranz-tv:quota-exhausted', '1234567890')
      localStorage.setItem('kranz-tv:custom-channels', '[]')
      localStorage.setItem('kranz-tv:overlay-mode', 'crt')

      clearPresetChannelCache()

      expect(localStorage.getItem('kranz-tv:quota-exhausted')).toBe('1234567890')
      expect(localStorage.getItem('kranz-tv:custom-channels')).toBe('[]')
      expect(localStorage.getItem('kranz-tv:overlay-mode')).toBe('crt')
    })

    it('leaves custom channel cache keys untouched', () => {
      const customKey = 'kranz-tv:channel-cache:my-custom-channel'
      localStorage.setItem(customKey, JSON.stringify({ channel: makeChannel('my-custom-channel'), cachedAt: Date.now() }))

      clearPresetChannelCache()

      expect(localStorage.getItem(customKey)).not.toBeNull()
    })

    it('is a no-op (SSR guard) when window is undefined', () => {
      const originalWindow = globalThis.window
      // @ts-expect-error — simulate SSR
      delete globalThis.window
      try {
        expect(() => clearPresetChannelCache()).not.toThrow()
      } finally {
        globalThis.window = originalWindow
      }
    })
  })
})
