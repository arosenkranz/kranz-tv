export type MediaSourceId = 'youtube' | 'soundcloud'

export interface ImportedPlaylist {
  readonly title: string
  readonly tracks: ReadonlyArray<{
    readonly id: string
    readonly title: string
    readonly artist: string
    readonly durationSeconds: number
    readonly embedUrl: string
  }>
  readonly totalDurationSeconds: number
}

export type ImportErrorCode =
  | 'INVALID_URL'
  | 'PRIVATE_PLAYLIST'
  | 'PLAYLIST_NOT_FOUND'
  | 'EXCEEDS_TRACK_LIMIT'
  | 'METADATA_INCOMPLETE'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'

export interface ImportError {
  readonly code: ImportErrorCode
  readonly message: string
}

export interface MediaSourcePlayer {
  play: () => void
  pause: () => void
  seekTo: (positionMs: number) => void
  setVolume: (volume: number) => void
  destroy: () => void
}

export interface CreatePlayerArgs {
  readonly container: HTMLElement
  readonly sourceUrl: string
  readonly onReady?: () => void
  readonly onError?: (error: Error) => void
}

export interface MediaSource {
  readonly id: MediaSourceId
  readonly displayName: string
  matchesUrl: (url: string) => boolean
  importPlaylist: (url: string) => Promise<ImportedPlaylist>
  createPlayer: (args: CreatePlayerArgs) => MediaSourcePlayer
}
