import { describe, it, expect } from 'vitest'
import {
  ImportFormSchema,
  channelToPreset,
  getNextChannelNumber,
} from '~/lib/import/schema'
import type { Channel } from '~/lib/scheduling/types'

const makeChannel = (overrides: Partial<Channel> = {}): Channel => ({
  id: 'test-channel',
  number: 6,
  name: 'Test Channel',
  playlistId: 'PLxyz123',
  videos: [],
  totalDurationSeconds: 0,
  ...overrides,
})

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
})

describe('getNextChannelNumber', () => {
  it('returns 7 when no custom channels exist (max preset is 6)', () => {
    expect(getNextChannelNumber([])).toBe(7)
  })

  it('returns max(preset, custom) + 1 when custom channels are below preset max', () => {
    const channels = [makeChannel({ number: 3 })]
    expect(getNextChannelNumber(channels)).toBe(7)
  })

  it('returns max + 1 when custom channels are above preset max', () => {
    const channels = [makeChannel({ number: 6 }), makeChannel({ number: 8 })]
    expect(getNextChannelNumber(channels)).toBe(9)
  })

  it('handles a single custom channel at preset max', () => {
    const channels = [makeChannel({ number: 6 })]
    expect(getNextChannelNumber(channels)).toBe(7)
  })
})
