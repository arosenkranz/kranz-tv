import React, { useEffect, useRef, useState } from 'react'
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
 * Music channel view — consumes the shared SoundCloud widget from context.
 *
 * Architecture: there is exactly one SC iframe in the entire app, owned by
 * ScWidgetProvider. This component just calls loadPlaylist(url) when the
 * channel changes and reacts to widget events for status/progress.
 */
export function MusicChannelView({
  channel,
  position,
  isMuted,
  volume,
  onUnmute,
}: Props) {
  const { widget, status, currentUrl, loadPlaylist } = useScWidget()
  const [trackElapsed, setTrackElapsed] = useState(0)
  const driftCorrectedRef = useRef(false)
  const channelRef = useRef(channel)
  channelRef.current = channel
  const currentTrack = position.item as Track
  const durationSeconds = currentTrack.durationSeconds

  // Load the channel's playlist into the shared widget when the channel
  // changes. The provider handles deduping (no-op if same URL).
  useEffect(() => {
    if (!channel.tracks?.length) return
    loadPlaylist(channel.sourceUrl)
    driftCorrectedRef.current = false
  }, [channel.sourceUrl, channel.tracks?.length, loadPlaylist])

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

  // Mute toggle: pause vs play.
  useEffect(() => {
    if (!widget) return
    if (isMuted) {
      widget.setVolume(0)
      widget.pause()
    } else {
      widget.play()
    }
  }, [widget, isMuted])

  // Volume change: only adjust volume, never call play() here.
  useEffect(() => {
    if (!widget || isMuted) return
    widget.setVolume(Math.round(volume * 100))
  }, [widget, volume, isMuted])

  const isLoading = currentUrl !== channel.sourceUrl || status === 'mounting'

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
            if (widget) {
              widget.setVolume(Math.round(volume * 100))
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
