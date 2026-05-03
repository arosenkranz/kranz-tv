import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  saveCustomChannels,
  loadCustomChannels,
  getAllChannelIds,
} from './local-channels'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import type { Channel } from '~/lib/scheduling/types'

const makeChannel = (id: string, number: number): Channel => ({
  kind: 'video',
  id,
  number,
  name: `Channel ${id}`,
  playlistId: `PL_${id}`,
  videos: [
    {
      id: 'dQw4w9WgXcQ',
      title: `Video ${id}`,
      durationSeconds: 600,
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    },
  ],
  totalDurationSeconds: 600,
})

describe('saveCustomChannels', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persists channels to localStorage', () => {
    const channels = [makeChannel('custom-1', 20), makeChannel('custom-2', 21)]
    saveCustomChannels(channels)
    const raw = window.localStorage.getItem('kranz-tv:custom-channels')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toHaveLength(2)
  })

  it('accepts an empty array without error', () => {
    expect(() => saveCustomChannels([])).not.toThrow()
    const raw = window.localStorage.getItem('kranz-tv:custom-channels')
    expect(JSON.parse(raw ?? '[]')).toEqual([])
  })

  it('overwrites previously saved channels', () => {
    saveCustomChannels([makeChannel('first', 20)])
    saveCustomChannels([makeChannel('second', 21), makeChannel('third', 22)])
    const raw = window.localStorage.getItem('kranz-tv:custom-channels')
    const parsed = JSON.parse(raw!) as Channel[]
    expect(parsed).toHaveLength(2)
    expect(parsed[0]?.id).toBe('second')
  })

  it('throws when localStorage.setItem fails', () => {
    const storageStub = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn().mockImplementation(() => {
        throw new DOMException('QuotaExceededError')
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    }
    const originalStorage = Object.getOwnPropertyDescriptor(
      window,
      'localStorage',
    )
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storageStub,
    })

    try {
      expect(() => saveCustomChannels([makeChannel('x', 99)])).toThrow(
        'Failed to save custom channels',
      )
    } finally {
      if (originalStorage) {
        Object.defineProperty(window, 'localStorage', originalStorage)
      }
    }
  })
})

describe('loadCustomChannels', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns an empty array when nothing is stored', () => {
    expect(loadCustomChannels()).toEqual([])
  })

  it('returns previously saved channels', () => {
    const channels = [makeChannel('custom-a', 20), makeChannel('custom-b', 21)]
    saveCustomChannels(channels)
    const loaded = loadCustomChannels()
    expect(loaded).toHaveLength(2)
    expect(loaded[0]?.id).toBe('custom-a')
  })

  it('returns an empty array when localStorage contains malformed JSON', () => {
    window.localStorage.setItem(
      'kranz-tv:custom-channels',
      'this is not json ][',
    )
    expect(loadCustomChannels()).toEqual([])
  })

  it('returns an empty array when stored value is not an array', () => {
    window.localStorage.setItem(
      'kranz-tv:custom-channels',
      JSON.stringify({ id: 'oops' }),
    )
    expect(loadCustomChannels()).toEqual([])
  })

  it('returns an empty array when stored channels have invalid video IDs', () => {
    const badChannel = {
      id: 'bad-vids',
      number: 30,
      name: 'Bad Videos',
      playlistId: 'PL_bad',
      videos: [
        {
          id: 'too-short',
          title: 'Bad',
          durationSeconds: 60,
          thumbnailUrl: '',
        },
      ],
      totalDurationSeconds: 60,
    }
    window.localStorage.setItem(
      'kranz-tv:custom-channels',
      JSON.stringify([badChannel]),
    )
    expect(loadCustomChannels()).toEqual([])
  })

  it('returns an empty array when stored channels have invalid thumbnail URLs', () => {
    const badChannel = {
      id: 'bad-thumb',
      number: 31,
      name: 'Bad Thumb',
      playlistId: 'PL_badthumb',
      videos: [
        {
          id: 'dQw4w9WgXcQ',
          title: 'Good ID Bad Thumb',
          durationSeconds: 60,
          thumbnailUrl: 'https://evil.com/exploit.jpg',
        },
      ],
      totalDurationSeconds: 60,
    }
    window.localStorage.setItem(
      'kranz-tv:custom-channels',
      JSON.stringify([badChannel]),
    )
    expect(loadCustomChannels()).toEqual([])
  })
})

describe('getAllChannelIds', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns all preset ids when no custom channels exist', () => {
    const ids = getAllChannelIds()
    const presetIds = CHANNEL_PRESETS.map((p) => p.id)
    expect(ids).toEqual(presetIds)
  })

  it('includes custom channel ids after preset ids', () => {
    saveCustomChannels([makeChannel('my-channel', 99)])
    const ids = getAllChannelIds()
    expect(ids).toContain('my-channel')
    // Custom id appears after all presets
    const lastPresetIndex = ids.indexOf(
      CHANNEL_PRESETS[CHANNEL_PRESETS.length - 1].id,
    )
    const customIndex = ids.indexOf('my-channel')
    expect(customIndex).toBeGreaterThan(lastPresetIndex)
  })

  it('does not duplicate ids when a custom channel shares an id with a preset', () => {
    const conflictId = CHANNEL_PRESETS[0].id
    saveCustomChannels([makeChannel(conflictId, 1)])
    const ids = getAllChannelIds()
    const count = ids.filter((id) => id === conflictId).length
    expect(count).toBe(1)
  })

  it('returns unique ids across multiple custom channels', () => {
    saveCustomChannels([makeChannel('dup', 20), makeChannel('dup', 21)])
    const ids = getAllChannelIds()
    const dupCount = ids.filter((id) => id === 'dup').length
    expect(dupCount).toBe(1)
  })

  it('returns an array with at least as many entries as there are presets', () => {
    const ids = getAllChannelIds()
    expect(ids.length).toBeGreaterThanOrEqual(CHANNEL_PRESETS.length)
  })
})

describe('backward compatibility — optional description field', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('round-trips channels with a description', () => {
    const channel: Channel = {
      ...makeChannel('with-desc', 20),
      description: 'My custom desc',
    }
    saveCustomChannels([channel])
    const loaded = loadCustomChannels()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.description).toBe('My custom desc')
  })

  it('loads channels without a description (old data)', () => {
    const oldData = [
      {
        id: 'old-channel',
        number: 20,
        name: 'Old Channel',
        playlistId: 'PL_old',
        videos: [
          {
            id: 'dQw4w9WgXcQ',
            title: 'Video',
            durationSeconds: 600,
            thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          },
        ],
        totalDurationSeconds: 600,
      },
    ]
    window.localStorage.setItem(
      'kranz-tv:custom-channels',
      JSON.stringify(oldData),
    )
    const loaded = loadCustomChannels()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.description).toBeUndefined()
  })
})
