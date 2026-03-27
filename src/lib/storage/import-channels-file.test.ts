import { describe, it, expect } from 'vitest'
import type { Channel } from '~/lib/scheduling/types'
import { importChannelsFromFile } from '~/lib/storage/import-channels-file'

const PRESET_IDS = new Set(['skate', 'music', 'party'])

const makeChannel = (overrides: Partial<Channel> = {}): Channel => ({
  id: 'my-channel',
  number: 6,
  name: 'My Channel',
  playlistId: 'PLxyz123',
  videos: [],
  totalDurationSeconds: 0,
  ...overrides,
})

const validEnvelope = {
  version: 1,
  exportedAt: '2026-03-26T00:00:00.000Z',
  channels: [makeChannel()],
}

const makeFile = (content: string, sizeBytes?: number): File => {
  const file = new File([content], 'channels.json', {
    type: 'application/json',
  })
  // Allow size override for the size-guard tests
  if (sizeBytes !== undefined) {
    Object.defineProperty(file, 'size', {
      value: sizeBytes,
      configurable: true,
    })
  }
  return file
}

describe('importChannelsFromFile', () => {
  describe('file size guard', () => {
    it('returns file-too-large error when file exceeds 5MB', async () => {
      const oversizedFile = makeFile('{}', 5 * 1024 * 1024 + 1)
      const result = await importChannelsFromFile(oversizedFile, [], PRESET_IDS)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toMatch(/too large/i)
      }
    })

    it('accepts a file exactly at 5MB', async () => {
      const ch = makeChannel()
      const envelope = {
        version: 1,
        exportedAt: '2026-03-26T00:00:00.000Z',
        channels: [ch],
      }
      const json = JSON.stringify(envelope)
      const file = makeFile(json, 5 * 1024 * 1024)
      const result = await importChannelsFromFile(file, [], PRESET_IDS)
      expect(result.success).toBe(true)
    })
  })

  describe('malformed JSON', () => {
    it('returns invalid-json error for non-JSON content', async () => {
      const file = makeFile('this is not json')
      const result = await importChannelsFromFile(file, [], PRESET_IDS)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toMatch(/not valid json/i)
      }
    })

    it('returns invalid-json error for truncated JSON', async () => {
      const file = makeFile('{ "version": 1, "channels": [')
      const result = await importChannelsFromFile(file, [], PRESET_IDS)
      expect(result.success).toBe(false)
    })
  })

  describe('schema validation', () => {
    it('returns validation error for completely wrong JSON shape', async () => {
      const file = makeFile(JSON.stringify({ foo: 'bar' }))
      const result = await importChannelsFromFile(file, [], PRESET_IDS)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toMatch(/invalid file/i)
      }
    })

    it('accepts a valid envelope format', async () => {
      const file = makeFile(JSON.stringify(validEnvelope))
      const result = await importChannelsFromFile(file, [], PRESET_IDS)
      expect(result.success).toBe(true)
    })

    it('accepts a raw channel array (no envelope wrapper)', async () => {
      const channels = [makeChannel({ id: 'raw', playlistId: 'PLraw' })]
      const file = makeFile(JSON.stringify(channels))
      const result = await importChannelsFromFile(file, [], PRESET_IDS)
      expect(result.success).toBe(true)
    })

    it('rejects an envelope with version !== 1', async () => {
      const badEnvelope = { ...validEnvelope, version: 2 }
      const file = makeFile(JSON.stringify(badEnvelope))
      const result = await importChannelsFromFile(file, [], PRESET_IDS)
      expect(result.success).toBe(false)
    })
  })

  describe('single object normalization', () => {
    it('wraps a single channel object in an array', async () => {
      const file = makeFile(
        JSON.stringify(makeChannel({ id: 'solo', playlistId: 'PLsolo' })),
      )
      const result = await importChannelsFromFile(file, [], PRESET_IDS)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.importedCount).toBe(1)
      }
    })
  })

  describe('deduplication integration', () => {
    it('skips channels already in existing list by playlistId', async () => {
      const existing = [makeChannel({ playlistId: 'PLxyz123' })]
      const file = makeFile(JSON.stringify(validEnvelope))
      const result = await importChannelsFromFile(file, existing, PRESET_IDS)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.importedCount).toBe(0)
        expect(result.skippedCount).toBe(1)
      }
    })

    it('re-slugs a preset ID collision', async () => {
      const skateChannel = makeChannel({
        id: 'skate',
        playlistId: 'PLbrandnew',
      })
      const envelope = {
        version: 1,
        exportedAt: '2026-03-26T00:00:00.000Z',
        channels: [skateChannel],
      }
      const file = makeFile(JSON.stringify(envelope))
      const result = await importChannelsFromFile(file, [], PRESET_IDS)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.merged[0].id).toBe('skate-imported')
      }
    })
  })

  describe('success result shape', () => {
    it('returns merged array, importedCount, and skippedCount on success', async () => {
      const file = makeFile(JSON.stringify(validEnvelope))
      const result = await importChannelsFromFile(file, [], PRESET_IDS)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(Array.isArray(result.merged)).toBe(true)
        expect(typeof result.importedCount).toBe('number')
        expect(typeof result.skippedCount).toBe('number')
      }
    })
  })
})
