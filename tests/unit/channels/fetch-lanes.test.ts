import { describe, it, expect } from 'vitest'
import {
  buildFetchLanes,
  channelIdFromPath,
} from '~/lib/channels/fetch-lanes'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import type { ChannelPreset } from '~/lib/channels/types'

function makePreset(
  id: string,
  kind: 'video' | 'music',
  number: number,
): ChannelPreset {
  const base = {
    id,
    number,
    name: id.toUpperCase(),
    description: '',
    emoji: '📺',
  }
  if (kind === 'music') {
    return {
      ...base,
      kind: 'music',
      source: 'soundcloud',
      sourceUrl: `https://soundcloud.com/x/sets/${id}`,
    }
  }
  return { ...base, kind: 'video', playlistId: `PL_${id}` }
}

const PRESETS: readonly ChannelPreset[] = [
  makePreset('v1', 'video', 1),
  makePreset('v2', 'video', 2),
  makePreset('v3', 'video', 3),
  makePreset('m1', 'music', 4),
  makePreset('m2', 'music', 5),
  makePreset('m3', 'music', 6),
]

describe('buildFetchLanes', () => {
  it('partitions presets into video and music lanes preserving order', () => {
    const { videoLane, musicLane } = buildFetchLanes(PRESETS, null)
    expect(videoLane.map((p) => p.id)).toEqual(['v1', 'v2', 'v3'])
    expect(musicLane.map((p) => p.id)).toEqual(['m1', 'm2', 'm3'])
  })

  it('hoists an active music channel to the front of the music lane only', () => {
    const { videoLane, musicLane } = buildFetchLanes(PRESETS, 'm3')
    expect(musicLane.map((p) => p.id)).toEqual(['m3', 'm1', 'm2'])
    expect(videoLane.map((p) => p.id)).toEqual(['v1', 'v2', 'v3'])
  })

  it('hoists an active video channel to the front of the video lane only', () => {
    const { videoLane, musicLane } = buildFetchLanes(PRESETS, 'v3')
    expect(videoLane.map((p) => p.id)).toEqual(['v3', 'v1', 'v2'])
    expect(musicLane.map((p) => p.id)).toEqual(['m1', 'm2', 'm3'])
  })

  it('leaves lanes unchanged when the active channel is already first', () => {
    const { videoLane } = buildFetchLanes(PRESETS, 'v1')
    expect(videoLane.map((p) => p.id)).toEqual(['v1', 'v2', 'v3'])
  })

  it('leaves lanes unchanged for an unknown active channel (custom channel)', () => {
    const { videoLane, musicLane } = buildFetchLanes(PRESETS, 'custom-abc')
    expect(videoLane.map((p) => p.id)).toEqual(['v1', 'v2', 'v3'])
    expect(musicLane.map((p) => p.id)).toEqual(['m1', 'm2', 'm3'])
  })

  it('does not mutate the input array', () => {
    const input = [...PRESETS]
    buildFetchLanes(input, 'm2')
    expect(input.map((p) => p.id)).toEqual([
      'v1',
      'v2',
      'v3',
      'm1',
      'm2',
      'm3',
    ])
  })

  it('covers every real preset exactly once across both lanes', () => {
    const { videoLane, musicLane } = buildFetchLanes(CHANNEL_PRESETS, null)
    const laneIds = [...videoLane, ...musicLane].map((p) => p.id).sort()
    const presetIds = CHANNEL_PRESETS.map((p) => p.id).sort()
    expect(laneIds).toEqual(presetIds)
  })
})

describe('channelIdFromPath', () => {
  it('extracts the id from a channel path', () => {
    expect(channelIdFromPath('/channel/sc-eclectic')).toBe('sc-eclectic')
  })

  it('tolerates a trailing slash', () => {
    expect(channelIdFromPath('/channel/skate/')).toBe('skate')
  })

  it('returns null for the root path', () => {
    expect(channelIdFromPath('/')).toBeNull()
  })

  it('returns null for non-channel paths', () => {
    expect(channelIdFromPath('/about')).toBeNull()
    expect(channelIdFromPath('/channel')).toBeNull()
    expect(channelIdFromPath('/channel/a/b')).toBeNull()
  })
})
