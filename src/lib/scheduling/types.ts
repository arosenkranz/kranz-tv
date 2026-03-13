export interface Video {
  readonly id: string
  readonly title: string
  readonly durationSeconds: number
  readonly thumbnailUrl: string
}

export interface Channel {
  readonly id: string
  readonly number: number
  readonly name: string
  readonly playlistId: string
  readonly videos: ReadonlyArray<Video>
  readonly totalDurationSeconds: number
}

export interface SchedulePosition {
  readonly video: Video
  readonly seekSeconds: number
  readonly slotStartTime: Date
  readonly slotEndTime: Date
}

export interface EpgEntry {
  readonly video: Video
  readonly channelId: string
  readonly startTime: Date
  readonly endTime: Date
  readonly isCurrentlyPlaying: boolean
}
