import type { MediaSource, MediaSourceId, ImportedPlaylist, MediaSourcePlayer, CreatePlayerArgs } from '../types'
import { extractPlaylistId } from '~/lib/import/parser'

export const YoutubeAdapter: MediaSource = {
  id: 'youtube' as MediaSourceId,
  displayName: 'YouTube',

  matchesUrl(url: string): boolean {
    return extractPlaylistId(url) !== null
  },

  async importPlaylist(_url: string): Promise<ImportedPlaylist> {
    throw new Error('YouTube importPlaylist not yet implemented via adapter')
  },

  createPlayer(_args: CreatePlayerArgs): MediaSourcePlayer {
    throw new Error('YouTube createPlayer not yet implemented via adapter')
  },
}
