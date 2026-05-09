// ── Media items ──────────────────────────────────────────────────────────────

export interface Video {
  readonly id: string
  readonly title: string
  readonly durationSeconds: number
  readonly thumbnailUrl: string
}

export interface Track {
  readonly id: string
  readonly title: string
  readonly artist: string
  readonly durationSeconds: number
  readonly embedUrl: string
}

// ── Schedulable ───────────────────────────────────────────────────────────────

/**
 * Minimal interface that allows the scheduler to walk any playlist.
 * Both Video and Track satisfy this interface.
 */
export interface Schedulable {
  readonly id: string
  readonly durationSeconds: number
}

// ── Channels ──────────────────────────────────────────────────────────────────

export interface VideoChannel {
  readonly kind: 'video'
  readonly id: string
  readonly number: number
  readonly name: string
  readonly playlistId: string
  readonly videos: ReadonlyArray<Video>
  readonly totalDurationSeconds: number
  readonly description?: string
}

export interface MusicChannel {
  readonly kind: 'music'
  readonly id: string
  readonly number: number
  readonly name: string
  readonly source: 'soundcloud'
  readonly sourceUrl: string
  readonly totalDurationSeconds: number
  readonly trackCount: number
  readonly description?: string
  /** Loaded async from IndexedDB on hydrate — not persisted to localStorage */
  readonly tracks?: ReadonlyArray<Track>
}

export type Channel = VideoChannel | MusicChannel

// ── Schedule ──────────────────────────────────────────────────────────────────

export interface SchedulePosition {
  readonly item: Schedulable
  readonly seekSeconds: number
  readonly slotStartTime: Date
  readonly slotEndTime: Date
  /** @deprecated Use item instead */
  readonly video?: Video
}

export interface EpgEntry {
  readonly video: Video
  /** Display label: "Track Title — Artist" for music, "Video Title" for video. */
  readonly label: string
  readonly channelId: string
  readonly startTime: Date
  readonly endTime: Date
  readonly isCurrentlyPlaying: boolean
}

// ── View models ───────────────────────────────────────────────────────────────

/**
 * Normalised schedule entry for EPG / info panel rendering.
 * Consumers do not branch on channel.kind — call toScheduleItem() instead.
 */
export interface ScheduleItem {
  readonly id: string
  readonly primaryLabel: string
  readonly secondaryLabel?: string
  readonly durationSeconds: number
  readonly thumbnailUrl?: string
  readonly deepLinkUrl?: string
  readonly deepLinkLabel?: string
}
