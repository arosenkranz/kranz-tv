import type {
  MediaSource,
  MediaSourceId,
  ImportedPlaylist,
  MediaSourcePlayer,
  CreatePlayerArgs,
} from '../types'
import { isSoundCloudUrl } from './parser'
import {
  SoundCloudWidgetWrapper,
  buildWidgetSrc,
  soundDataToTrack,
} from './widget'

const IMPORT_TIMEOUT_MS = 10_000
const MAX_TRACKS = 50
const POLL_INTERVAL_MS = 250

function importFromIframe(url: string): Promise<ImportedPlaylist> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.src = buildWidgetSrc(url)
    iframe.sandbox.value =
      'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'
    iframe.allow = 'autoplay; encrypted-media'
    iframe.referrerPolicy = 'strict-origin-when-cross-origin'
    iframe.style.cssText =
      'position:absolute;width:0;height:0;border:0;visibility:hidden;'
    document.body.appendChild(iframe)

    const widget = new SoundCloudWidgetWrapper(iframe)
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const cleanup = (): void => {
      if (pollTimer !== null) clearInterval(pollTimer)
      widget.dispose()
      iframe.src = 'about:blank'
      document.body.removeChild(iframe)
    }

    const timeoutTimer = setTimeout(() => {
      cleanup()
      reject(new Error('TIMEOUT'))
    }, IMPORT_TIMEOUT_MS)

    widget.on('ready', () => {
      const startPoll = (): void => {
        pollTimer = setInterval(() => {
          void widget.getSounds().then((sounds) => {
            if (sounds.length === 0) return
            if (sounds.length > MAX_TRACKS) {
              clearTimeout(timeoutTimer)
              cleanup()
              reject(new Error('EXCEEDS_TRACK_LIMIT'))
              return
            }
            const allComplete = sounds.every(
              (s) => s.duration !== undefined && s.title !== undefined,
            )
            if (!allComplete) return

            clearTimeout(timeoutTimer)
            cleanup()

            const tracks = sounds.map(soundDataToTrack)
            const totalDurationSeconds = tracks.reduce(
              (sum, t) => sum + t.durationSeconds,
              0,
            )
            resolve({ title: '', tracks, totalDurationSeconds })
          })
        }, POLL_INTERVAL_MS)
      }
      startPoll()
    })

    widget.on('error', () => {
      clearTimeout(timeoutTimer)
      cleanup()
      reject(new Error('PLAYLIST_NOT_FOUND'))
    })
  })
}

export const SoundCloudAdapter: MediaSource = {
  id: 'soundcloud' as MediaSourceId,
  displayName: 'SoundCloud',

  matchesUrl(url: string): boolean {
    return isSoundCloudUrl(url)
  },

  async importPlaylist(url: string): Promise<ImportedPlaylist> {
    return importFromIframe(url)
  },

  createPlayer(_args: CreatePlayerArgs): MediaSourcePlayer {
    throw new Error('SoundCloud createPlayer not yet implemented')
  },
}
