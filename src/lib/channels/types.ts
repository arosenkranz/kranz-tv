import type { Channel, Video } from '../scheduling/types.ts'

export type { Channel, Video }

export interface ChannelPreset {
  readonly id: string
  readonly number: number
  readonly name: string
  readonly description: string
  readonly playlistId: string
  readonly emoji: string
}
