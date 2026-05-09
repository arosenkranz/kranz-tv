import { useEffect, useRef, useState } from 'react'
import type {
  MusicChannel,
  SchedulePosition,
  Track,
} from '~/lib/scheduling/types'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import { NowPlayingCard } from './now-playing-card'
import { useScWidget } from '~/lib/sources/soundcloud/sc-widget-context'

const DRIFT_THRESHOLD_SECONDS = 3

interface Props {
  channel: MusicChannel
  position: SchedulePosition
  isMuted: boolean
  volume: number
  onUnmute: () => void
}

/**
 * Music channel view — pure view component. Widget orchestration
 * (load, play, pause, skip, seek, mute) is owned by ScWidgetProvider
 * via setActiveChannel(). This component only:
 *   - declares the active channel
 *   - subscribes to playProgress for elapsed-time UI + soft drift correction
 *   - renders the now-playing card and the unmute button
 *
 * The shared SC widget belongs to the provider and is paused
 * automatically by the channel route when navigating to a non-music
 * channel — see _tv.channel.$channelId.tsx.
 */
export function MusicChannelView({
  channel,
  position,
  isMuted,
  volume,
  onUnmute,
}: Props) {
  const { widget, status, activeChannelId } = useScWidget()
  const [trackElapsed, setTrackElapsed] = useState(0)
  const driftCorrectedRef = useRef(false)
  const channelRef = useRef(channel)
  channelRef.current = channel
  const currentTrack = position.item as Track
  const durationSeconds = currentTrack.durationSeconds

  // Reset drift flag when the channel changes (route already calls
  // setActiveChannel — we just need to know the playProgress drift
  // check should re-run for the new channel).
  useEffect(() => {
    driftCorrectedRef.current = false
  }, [channel.id])

  // Subscribe to playProgress for elapsed time + soft drift correction.
  useEffect(() => {
    if (!widget) return
    const onProgress = (data?: unknown): void => {
      const msg = data as { currentPosition?: number }
      const elapsedMs = msg.currentPosition ?? 0
      setTrackElapsed(elapsedMs / 1000)

      if (!driftCorrectedRef.current) {
        const actualElapsed = elapsedMs / 1000
        const livePos = getSchedulePosition(channelRef.current, new Date())
        const drift = Math.abs(actualElapsed - livePos.seekSeconds)
        driftCorrectedRef.current = true
        if (drift > DRIFT_THRESHOLD_SECONDS) {
          widget.seekTo(livePos.seekSeconds * 1000)
        }
      }
    }
    widget.on('playProgress', onProgress)
    // No off() — the widget is shared; we tolerate the listener accumulating
    // since loadPlaylist resets the player and old callbacks become inert.
  }, [widget])

  // Reset drift flag when tab regains visibility — playProgress will re-check.
  useEffect(() => {
    const onVis = (): void => {
      if (!document.hidden) driftCorrectedRef.current = false
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const isLoading = activeChannelId !== channel.id || status === 'mounting'

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#000',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 30% 40%, #1a0a2e 0%, #0d0d1a 50%, #000 100%)',
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 15,
          fontFamily: "'VT323', 'Courier New', monospace",
          fontSize: '0.875rem',
          letterSpacing: '0.1em',
          color:
            status === 'playing'
              ? '#39ff14'
              : status === 'ready'
                ? '#ffaa00'
                : status === 'error'
                  ? '#ff3333'
                  : 'rgba(255,255,255,0.6)',
          background: 'rgba(0,0,0,0.6)',
          padding: '4px 10px',
          borderRadius: 2,
          textTransform: 'uppercase',
        }}
      >
        ● {status}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          right: 24,
          zIndex: 10,
        }}
      >
        <NowPlayingCard
          primaryLabel={currentTrack.title}
          secondaryLabel={currentTrack.artist || undefined}
          elapsedSeconds={trackElapsed}
          durationSeconds={durationSeconds}
          deepLinkUrl={currentTrack.embedUrl}
          deepLinkLabel="OPEN ON SOUNDCLOUD"
        />
      </div>

      {isMuted && (
        <button
          onClick={() => {
            // Synchronous user-gesture call so browsers honor autoplay.
            // The provider's mute effect will also fire when the parent
            // toggles isMuted, but doing it synchronously here ensures
            // the gesture is in the same JS turn as the click.
            if (widget) {
              widget.setVolume(volume)
              widget.play()
            }
            onUnmute()
          }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 20,
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            border: '2px solid #fff',
            padding: '12px 24px',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          {isLoading ? 'LOADING… TAP TO UNMUTE' : 'TAP TO UNMUTE'}
        </button>
      )}
    </div>
  )
}

export { SC_WIDGET_ORIGIN } from '~/lib/sources/soundcloud/widget'
