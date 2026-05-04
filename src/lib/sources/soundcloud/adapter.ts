import type { MediaSource, MediaSourceId, ImportedPlaylist, MediaSourcePlayer, CreatePlayerArgs } from '../types'
import { isSoundCloudUrl } from './parser'

export const SoundCloudAdapter: MediaSource = {
  id: 'soundcloud' as MediaSourceId,
  displayName: 'SoundCloud',

  matchesUrl(url: string): boolean {
    return isSoundCloudUrl(url)
  },

  async importPlaylist(_url: string): Promise<ImportedPlaylist> {
    throw new Error('SoundCloud importPlaylist not yet implemented')
  },

  createPlayer(_args: CreatePlayerArgs): MediaSourcePlayer {
    throw new Error('SoundCloud createPlayer not yet implemented')
  },
}
