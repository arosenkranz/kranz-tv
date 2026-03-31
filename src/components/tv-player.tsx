import { useEffect, useRef } from 'react'
import {
  loadYouTubeAPI,
  createPlayer,
  loadVideo,
} from '~/lib/player/youtube-iframe'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import { trackPlayerError, trackPlayerResync } from '~/lib/datadog/rum'
import {
  logPlayerError,
  logPlayerCreationFailed,
  logScheduleDesync,
} from '~/lib/datadog/logs'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'

export interface TvPlayerProps {
  channel: Channel
  position: SchedulePosition
  isMuted: boolean
  volume?: number
  onNeedsInteraction?: () => void
  onResync?: () => void
  /** Allow pointer events on the iframe — required on mobile where a real tap
   *  is needed to satisfy browser autoplay policy. Desktop keeps pointer-events
   *  none so arrow keys always reach the React listener instead of the iframe. */
  allowInteraction?: boolean
}

export function TvPlayer({
  channel,
  position,
  isMuted,
  volume = 80,
  onNeedsInteraction,
  onResync,
  allowInteraction = false,
}: TvPlayerProps) {
  const playerRef = useRef<YT.Player | null>(null)
  const channelRef = useRef(channel)
  const positionRef = useRef(position)
  const isMutedRef = useRef(isMuted)
  const volumeRef = useRef(volume)
  const onNeedsInteractionRef = useRef(onNeedsInteraction)
  const onResyncRef = useRef(onResync)
  const containerId = 'youtube-player'

  // Keep refs current without triggering player recreation
  channelRef.current = channel
  positionRef.current = position
  isMutedRef.current = isMuted
  volumeRef.current = volume
  onNeedsInteractionRef.current = onNeedsInteraction
  onResyncRef.current = onResync

  // Sync mute state to the player whenever it changes
  useEffect(() => {
    if (playerRef.current === null) return
    if (isMuted) {
      playerRef.current.mute()
    } else {
      playerRef.current.unMute()
    }
  }, [isMuted])

  // Sync volume level to the player whenever it changes
  useEffect(() => {
    if (playerRef.current === null) return
    playerRef.current.setVolume(volume)
  }, [volume])

  useEffect(() => {
    let destroyed = false
    let hasUnmuted = false

    const handleStateChange = (event: YT.OnStateChangeEvent): void => {
      if (destroyed || playerRef.current === null) return

      if (event.data === 1 /* PLAYING */) {
        if (!hasUnmuted) {
          // First PLAYING after load — attempt to unmute.
          // Browser may block unMute() without prior user interaction; if so,
          // it immediately pauses — detect that and surface a prompt instead.
          hasUnmuted = true
          if (!isMutedRef.current) {
            playerRef.current.unMute()
            setTimeout(() => {
              if (
                playerRef.current &&
                playerRef.current.getPlayerState() === 2 /* PAUSED */
              ) {
                playerRef.current.mute()
                playerRef.current.playVideo()
                onNeedsInteractionRef.current?.()
              }
            }, 50)
          }
        }
      }

      if (event.data === 2 /* PAUSED */ && hasUnmuted) {
        // Real TV doesn't pause. Use a short debounce before resyncing because
        // YouTube fires transient PAUSED events during buffering and quality
        // switches — we only want to resync on a genuine user-initiated pause.
        setTimeout(() => {
          if (
            playerRef.current &&
            playerRef.current.getPlayerState() === 2 /* still PAUSED */
          ) {
            const live = getSchedulePosition(channelRef.current, new Date())
            trackPlayerResync(channelRef.current.id, live.video.id)
            logScheduleDesync(channelRef.current.id, live.video.id)
            onResyncRef.current?.()
            loadVideo(playerRef.current, live.video.id, live.seekSeconds)
          }
        }, 300)
      }

      if (event.data === 0 /* ENDED */) {
        const next = getSchedulePosition(channelRef.current, new Date())
        loadVideo(playerRef.current, next.video.id, next.seekSeconds)
      }
    }

    // Defer player creation by one microtask tick so React StrictMode's
    // synchronous cleanup (destroyed = true) runs before we touch the DOM.
    // Without this, both StrictMode effect runs race to create a YT.Player
    // on the same container, and the first one's onReady tears out the iframe
    // just as the second one needs it.
    const timer = setTimeout(() => {
      if (destroyed) return

      loadYouTubeAPI()
        .then(() => {
          // Compute a fresh position at player-creation time rather than reading
          // positionRef — the ref may hold stale data if channelRef updated
          // between scheduling this timer and it firing.
          const fresh = getSchedulePosition(channelRef.current, new Date())
          return createPlayer({
            containerId,
            videoId: fresh.video.id,
            startSeconds: fresh.seekSeconds,
            onReady: (player) => {
              if (!destroyed) {
                playerRef.current = player
                player.setVolume(volumeRef.current)
                if (isMutedRef.current) {
                  player.mute()
                } else {
                  player.unMute()
                }
                player.playVideo()
              } else {
                player.destroy()
              }
            },
            onStateChange: handleStateChange,
            onError: (event) => {
              trackPlayerError(
                event.data,
                positionRef.current.video.id,
                channelRef.current.id,
              )
              logPlayerError(
                event.data,
                positionRef.current.video.id,
                channelRef.current.id,
              )
            },
          })
        })
        .catch((err: unknown) => {
          logPlayerCreationFailed(
            channelRef.current.id,
            err instanceof Error ? err.message : String(err),
          )
        })
    }, 0)

    return () => {
      destroyed = true
      clearTimeout(timer)
      if (playerRef.current !== null) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [channel.id])

  return (
    <div
      className="w-full h-full bg-black"
      style={{ pointerEvents: allowInteraction ? 'auto' : 'none' }}
    >
      {/* pointer-events: none on the wrapper prevents the YouTube iframe from
          ever receiving clicks or capturing keyboard focus. YT API calls go via
          postMessage so playback control is unaffected — but arrow keys always
          reach the React keydown listener on window instead of YouTube's handler.
          On mobile, pointer-events must be auto so the iframe can receive the
          tap required by browser autoplay policy. */}
      <div id={containerId} className="w-full h-full" />
    </div>
  )
}
