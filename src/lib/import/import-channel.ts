import {
  fetchPlaylistVideoIds,
  fetchVideoDetails,
} from '~/lib/channels/youtube-api'
import { extractPlaylistId } from './parser'
import type { ImportResult } from './schema'
import type { Channel } from '~/lib/scheduling/types'

/** Converts a user-supplied name into a URL-safe channel ID. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Fetches a YouTube playlist and builds a custom Channel.
 *
 * Returns { success: true, channel } on success or
 * { success: false, error } with a user-friendly message on failure.
 */
export async function importChannel(
  url: string,
  channelName: string,
  nextNumber: number,
  apiKey: string,
): Promise<ImportResult> {
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      error:
        'YouTube API key is required to import channels. Add VITE_YOUTUBE_API_KEY to your .env file.',
    }
  }

  const playlistId = extractPlaylistId(url)
  if (playlistId === null) {
    return {
      success: false,
      error:
        'Could not find a valid YouTube playlist ID in that URL. Try pasting a playlist URL like youtube.com/playlist?list=...',
    }
  }

  try {
    const videoIds = await fetchPlaylistVideoIds(playlistId, apiKey)
    if (videoIds.length === 0) {
      return {
        success: false,
        error:
          'That playlist appears to be empty. Make sure it has at least one public video.',
      }
    }

    const unordered = await fetchVideoDetails(videoIds, apiKey)

    // Restore playlist order (videos.list returns results in arbitrary order)
    const indexMap = new Map(videoIds.map((id, i) => [id, i]))
    const videos = [...unordered].sort(
      (a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0),
    )

    const totalDurationSeconds = videos.reduce(
      (sum, v) => sum + v.durationSeconds,
      0,
    )

    const channel: Channel = {
      id: slugify(channelName) || `channel-${nextNumber}`,
      number: nextNumber,
      name: channelName.trim(),
      playlistId,
      videos,
      totalDurationSeconds,
    }

    return { success: true, channel }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (message.includes('403')) {
      return {
        success: false,
        error: 'YouTube API key is invalid or quota exceeded.',
      }
    }
    if (message.includes('404')) {
      return {
        success: false,
        error:
          'Playlist not found. Make sure it is public and the URL is correct.',
      }
    }

    return { success: false, error: `Failed to import channel: ${message}` }
  }
}
