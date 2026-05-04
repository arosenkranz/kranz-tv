import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Channel } from '~/lib/scheduling/types'
import { exportChannelsAsJson } from '~/lib/storage/export-channels'

// Minimal Channel factory
const makeChannel = (overrides: Partial<Channel> = {}): Channel =>
  ({
    kind: 'video',
    id: 'my-channel',
    number: 6,
    name: 'My Channel',
    playlistId: 'PLxyz123',
    videos: [],
    totalDurationSeconds: 0,
    ...overrides,
  }) as Channel

// Mock anchor + URL APIs used for download trigger
let mockAnchor: HTMLAnchorElement
let mockClick: ReturnType<typeof vi.fn>
let mockRevokeObjectURL: ReturnType<typeof vi.fn>
let mockCreateObjectURL: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockClick = vi.fn()
  mockAnchor = {
    href: '',
    download: '',
    click: mockClick,
    style: {},
  } as unknown as HTMLAnchorElement

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') return mockAnchor
    return document.createElement(tag)
  })

  vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor)
  vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor)

  mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
  mockRevokeObjectURL = vi.fn()
  global.URL.createObjectURL = mockCreateObjectURL
  global.URL.revokeObjectURL = mockRevokeObjectURL
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('exportChannelsAsJson', () => {
  it('creates a Blob with the correct JSON structure', () => {
    const channels = [makeChannel({ id: 'skate', name: 'Skate' })]
    exportChannelsAsJson(channels)

    const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob
    expect(blobArg).toBeInstanceOf(Blob)
    expect(blobArg.type).toBe('application/json')
  })

  it('wraps channels in versioned envelope with exportedAt', async () => {
    const channels = [makeChannel()]
    exportChannelsAsJson(channels)

    const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob
    const text = await blobArg.text()
    const parsed: unknown = JSON.parse(text)

    expect(parsed).toMatchObject({
      version: 1,
      channels: expect.arrayContaining([
        expect.objectContaining({ id: 'my-channel' }),
      ]),
    })
    expect(typeof (parsed as Record<string, unknown>).exportedAt).toBe('string')
  })

  it('triggers anchor click to download', () => {
    exportChannelsAsJson([makeChannel()])
    expect(mockClick).toHaveBeenCalledOnce()
  })

  it('sets download filename with kranz-tv prefix and .json extension', () => {
    exportChannelsAsJson([makeChannel()])
    expect(mockAnchor.download).toMatch(/^kranz-tv-channels-.*\.json$/)
  })

  it('sets anchor href to the blob URL', () => {
    exportChannelsAsJson([makeChannel()])
    expect(mockAnchor.href).toBe('blob:mock-url')
  })

  it('revokes object URL after click', () => {
    exportChannelsAsJson([makeChannel()])
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('handles empty channels array without throwing', () => {
    expect(() => exportChannelsAsJson([])).not.toThrow()
  })

  it('serializes multiple channels', async () => {
    const channels = [
      makeChannel({ id: 'a', name: 'A' }),
      makeChannel({ id: 'b', name: 'B' }),
    ]
    exportChannelsAsJson(channels)

    const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob
    const text = await blobArg.text()
    const parsed = JSON.parse(text) as { channels: unknown[] }

    expect(parsed.channels).toHaveLength(2)
  })
})
