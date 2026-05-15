import { YouTubeQuotaError } from '~/lib/channels/youtube-api'
import { fetchYouTubePlaylist } from '~/routes/api/youtube'
import { fetchSoundCloudPlaylist } from '~/routes/api/soundcloud'
import { extractPlaylistId } from './parser'
import type { ImportResult } from './schema'
import type { Channel } from '~/lib/scheduling/types'
import { trackImportComplete } from '~/lib/datadog/rum'
import { logQuotaExhaustion, logImportError } from '~/lib/datadog/logs'
import { isSoundCloudUrl } from '~/lib/sources/soundcloud/parser'
import { saveTracks } from '~/lib/storage/track-db'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function importYouTubeChannel(
  url: string,
  channelName: string,
  nextNumber: number,
): Promise<ImportResult> {
  const playlistId = extractPlaylistId(url)
  if (playlistId === null) {
    trackImportComplete(false, 0, channelName)
    return {
      success: false,
      error:
        'Could not find a valid YouTube playlist ID in that URL. Try pasting a playlist URL like youtube.com/playlist?list=...',
    }
  }

  try {
    const videos = await fetchYouTubePlaylist({ data: { playlistId } })

    if (videos.length === 0) {
      trackImportComplete(false, 0, channelName)
      logImportError('Empty playlist', channelName)
      return {
        success: false,
        error: 'That playlist appears to be empty. Make sure it has at least one public video.',
      }
    }

    const totalDurationSeconds = videos.reduce((sum: number, v) => sum + v.durationSeconds, 0)
    const channel: Channel = {
      kind: 'video',
      id: slugify(channelName) || `channel-${nextNumber}`,
      number: nextNumber,
      name: channelName.trim(),
      playlistId,
      videos,
      totalDurationSeconds,
    }

    trackImportComplete(true, videos.length, channelName)
    return { success: true, channel }
  } catch (err) {
    if (err instanceof YouTubeQuotaError || (err instanceof Error && err.message === 'QUOTA_EXCEEDED')) {
      trackImportComplete(false, 0, channelName)
      logQuotaExhaustion({ channel_name: channelName })
      return { success: false, error: 'EXPERIENCING TECHNICAL DIFFICULTIES — PLEASE STAND BY' }
    }

    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('404')) {
      trackImportComplete(false, 0, channelName)
      logImportError('Playlist not found', channelName)
      return {
        success: false,
        error: 'Playlist not found. Make sure it is public and the URL is correct.',
      }
    }

    trackImportComplete(false, 0, channelName)
    logImportError(message, channelName)
    return { success: false, error: `Failed to import channel: ${message}` }
  }
}

async function importSoundCloudChannel(
  url: string,
  channelName: string,
  nextNumber: number,
): Promise<ImportResult> {
  try {
    const playlist = await fetchSoundCloudPlaylist({ data: { url } })
    const channelId = slugify(channelName) || `channel-${nextNumber}`

    const channel: Channel = {
      kind: 'music',
      id: channelId,
      number: nextNumber,
      name: channelName.trim(),
      source: 'soundcloud',
      sourceUrl: url,
      totalDurationSeconds: playlist.totalDurationSeconds,
      trackCount: playlist.tracks.length,
      tracks: playlist.tracks,
    }

    await saveTracks(channelId, [...playlist.tracks])
    trackImportComplete(true, playlist.tracks.length, channelName)
    return { success: true, channel }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (message === 'PLAYLIST_NOT_FOUND') {
      trackImportComplete(false, 0, channelName)
      logImportError('SC playlist not found', channelName)
      return {
        success: false,
        error: 'Playlist not found. Make sure it is public and the URL is correct.',
      }
    }

    trackImportComplete(false, 0, channelName)
    logImportError(message, channelName)
    return { success: false, error: `Failed to import channel: ${message}` }
  }
}

export async function importChannel(
  url: string,
  channelName: string,
  nextNumber: number,
): Promise<ImportResult> {
  if (isSoundCloudUrl(url)) {
    return importSoundCloudChannel(url, channelName, nextNumber)
  }
  return importYouTubeChannel(url, channelName, nextNumber)
}
