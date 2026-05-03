import { describe, it, expect } from 'vitest'
import {
  ImportFormSchema,
  channelToPreset,
  getNextChannelNumber,
  isChannelNumberAvailable,
} from '~/lib/import/schema'
import type { Channel } from '~/lib/scheduling/types'

const makeChannel = (overrides: Partial<Channel> = {}): Channel => ({
  kind: 'video',
  id: 'test-channel',
  number: 6,
  name: 'Test Channel',
  playlistId: 'PLxyz123',
  videos: [],
  totalDurationSeconds: 0,
  ...overrides,
} as Channel)

describe('ImportFormSchema', () => {
  it('accepts valid URL and channel name', () => {
    const result = ImportFormSchema.safeParse({
      url: 'https://www.youtube.com/playlist?list=PLxyz123',
      channelName: 'My Channel',
    })
    expect(result.success).toBe(true)
  })

  it('accepts bare playlist ID as url', () => {
    const result = ImportFormSchema.safeParse({
      url: 'PLmDOmgjgiHsiBYTWTmljl4E3Ft0DBVlDH',
      channelName: 'Skate',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty url', () => {
    const result = ImportFormSchema.safeParse({
      url: '',
      channelName: 'My Channel',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid URL (no playlist ID extractable)', () => {
    const result = ImportFormSchema.safeParse({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      channelName: 'My Channel',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty channel name', () => {
    const result = ImportFormSchema.safeParse({
      url: 'https://www.youtube.com/playlist?list=PLxyz123',
      channelName: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects channel name that is only whitespace', () => {
    const result = ImportFormSchema.safeParse({
      url: 'https://www.youtube.com/playlist?list=PLxyz123',
      channelName: '   ',
    })
    expect(result.success).toBe(false)
  })
})

describe('channelToPreset', () => {
  it('converts a Channel to a ChannelPreset with satellite emoji', () => {
    const channel = makeChannel({
      id: 'my-channel',
      number: 6,
      name: 'My Channel',
    })
    const preset = channelToPreset(channel)
    expect(preset.id).toBe('my-channel')
    expect(preset.number).toBe(6)
    expect(preset.name).toBe('My Channel')
    expect(preset.emoji).toBe('📡')
    expect(preset.description).toBe('Imported channel')
  })

  it('uses the channel playlistId', () => {
    const channel = makeChannel({ playlistId: 'PLxyz123' })
    const preset = channelToPreset(channel)
    expect(preset.playlistId).toBe('PLxyz123')
  })

  it('uses custom description when provided', () => {
    const channel = makeChannel({ description: 'My awesome channel' })
    const preset = channelToPreset(channel)
    expect(preset.description).toBe('My awesome channel')
  })

  it('falls back to "Imported channel" when description is undefined', () => {
    const channel = makeChannel()
    const preset = channelToPreset(channel)
    expect(preset.description).toBe('Imported channel')
  })
})

describe('getNextChannelNumber', () => {
  it('returns 16 when no custom channels exist (max preset is 15)', () => {
    expect(getNextChannelNumber([])).toBe(16)
  })

  it('returns max(preset, custom) + 1 when custom channels are below preset max', () => {
    const channels = [makeChannel({ number: 3 })]
    expect(getNextChannelNumber(channels)).toBe(16)
  })

  it('returns max + 1 when custom channels are above preset max', () => {
    const channels = [makeChannel({ number: 17 }), makeChannel({ number: 19 })]
    expect(getNextChannelNumber(channels)).toBe(20)
  })

  it('handles a single custom channel at preset max', () => {
    const channels = [makeChannel({ number: 15 })]
    expect(getNextChannelNumber(channels)).toBe(16)
  })
})

describe('isChannelNumberAvailable', () => {
  it('returns false for a number used by a preset channel', () => {
    expect(isChannelNumberAvailable(1, 'my-channel', [])).toBe(false)
  })

  it('returns false for a number used by another custom channel', () => {
    const channels = [makeChannel({ id: 'other', number: 16 })]
    expect(isChannelNumberAvailable(16, 'my-channel', channels)).toBe(false)
  })

  it('returns true for the channels own current number (self-exclusion)', () => {
    const channels = [makeChannel({ id: 'my-channel', number: 16 })]
    expect(isChannelNumberAvailable(16, 'my-channel', channels)).toBe(true)
  })

  it('returns true for an unused number', () => {
    const channels = [makeChannel({ id: 'other', number: 16 })]
    expect(isChannelNumberAvailable(20, 'my-channel', channels)).toBe(true)
  })
})
