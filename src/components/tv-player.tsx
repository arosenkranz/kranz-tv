import { useEffect, useRef } from 'react'
import { loadYouTubeAPI, createPlayer, loadVideo } from '~/lib/player/youtube-iframe'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'

export interface TvPlayerProps {
  channel: Channel
  position: SchedulePosition
}

export function TvPlayer({ channel, position }: TvPlayerProps) {
  const playerRef = useRef<YT.Player | null>(null)
  const channelRef = useRef(channel)
  const containerId = 'youtube-player'

  // Keep channelRef current so the state-change callback always sees the latest channel
  useEffect(() => {
    channelRef.current = channel
  }, [channel])

  useEffect(() => {
    let destroyed = false

    const handleStateChange = (event: YT.OnStateChangeEvent): void => {
      if (event.data === 0 /* ENDED */ && playerRef.current !== null && !destroyed) {
        const next = getSchedulePosition(channelRef.current, new Date())
        loadVideo(playerRef.current, next.video.id, next.seekSeconds)
      }
    }

    loadYouTubeAPI()
      .then(() =>
        createPlayer({
          containerId,
          videoId: position.video.id,
          startSeconds: position.seekSeconds,
          onReady: (player) => {
            if (!destroyed) {
              playerRef.current = player
            } else {
              player.destroy()
            }
          },
          onStateChange: handleStateChange,
        }),
      )
      .catch(() => {
        // Player creation failure is a non-fatal runtime issue.
        // The containing page can surface an error UI if needed.
      })

    return () => {
      destroyed = true
      if (playerRef.current !== null) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
    // We intentionally only re-create the player when channel or the initial
    // position changes (not on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, position.video.id])

  return (
    <div className="w-full aspect-video bg-black">
      <div id={containerId} className="w-full h-full" />
    </div>
  )
}
