import type { Channel, Video } from '../scheduling/types.ts'

export type { Channel, Video }

interface ChannelPresetCommon {
  readonly id: string
  readonly number: number
  readonly name: string
  readonly description: string
  readonly emoji: string
}

export interface VideoChannelPreset extends ChannelPresetCommon {
  readonly kind: 'video'
  readonly playlistId: string
}

export interface MusicChannelPreset extends ChannelPresetCommon {
  readonly kind: 'music'
  readonly source: 'soundcloud'
  readonly sourceUrl: string
}

export type ChannelPreset = VideoChannelPreset | MusicChannelPreset
