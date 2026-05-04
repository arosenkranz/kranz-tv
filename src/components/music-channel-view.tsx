import React, { useEffect, useRef, useState, useCallback } from 'react'
import type {
  MusicChannel,
  SchedulePosition,
  Track,
} from '~/lib/scheduling/types'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import { MusicVisualizerCanvas } from './music-visualizer-canvas'
import { NowPlayingCard } from './now-playing-card'
import {
  buildWidgetSrc,
  SoundCloudWidgetWrapper,
  SC_WIDGET_ORIGIN,
} from '~/lib/sources/soundcloud/widget'
import { resolvePreset } from '~/lib/visualizers/preset'

const DRIFT_THRESHOLD_SECONDS = 3

interface Props {
  channel: MusicChannel
  position: SchedulePosition
  isMuted: boolean
  onUnmute: () => void
}

export function MusicChannelView({
  channel,
  position,
  isMuted,
  onUnmute,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const widgetRef = useRef<SoundCloudWidgetWrapper | null>(null)
  const mountTokenRef = useRef<AbortController | null>(null)
  const driftCorrectedRef = useRef(false)
  const [trackElapsed, setTrackElapsed] = useState(0)
  const currentTrack = position.item as Track
  const durationSeconds = currentTrack.durationSeconds
  const trackProgress =
    durationSeconds > 0 ? Math.min(trackElapsed / durationSeconds, 1) : 0

  const preset = resolvePreset(
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams(),
  )

  // channelRef lets the visibility handler always read the current channel
  // without being captured in a stale closure from mount time.
  const channelRef = useRef(channel)
  channelRef.current = channel

  const handleReady = useCallback(
    (widget: SoundCloudWidgetWrapper, signal: AbortSignal) => {
      if (signal.aborted) return
      driftCorrectedRef.current = false
      // Compute live position at this exact moment (not mount time)
      const livePos = getSchedulePosition(channelRef.current, new Date())
      const trackIndex = channelRef.current.tracks?.findIndex(
        (t) => t.id === livePos.item.id,
      ) ?? 0
      widget.skip(Math.max(0, trackIndex))
      widget.seekTo(livePos.seekSeconds * 1000)
      if (!isMuted) widget.play()
    },
    [isMuted],
  )

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !channel.tracks?.length) return

    const mountToken = new AbortController()
    mountTokenRef.current = mountToken
    const { signal } = mountToken

    const widget = new SoundCloudWidgetWrapper(iframe)
    widgetRef.current = widget

    widget.on('ready', () => handleReady(widget, signal))

    widget.on('playProgress', (data) => {
      if (signal.aborted) return
      const msg = data as { currentPosition?: number }
      const elapsedMs = msg.currentPosition ?? 0
      setTrackElapsed(elapsedMs / 1000)

      if (!driftCorrectedRef.current) {
        const actualElapsed = elapsedMs / 1000
        const livePos = getSchedulePosition(channelRef.current, new Date())
        const drift = Math.abs(actualElapsed - livePos.seekSeconds)
        if (drift > DRIFT_THRESHOLD_SECONDS) {
          driftCorrectedRef.current = true
          widget.seekTo(livePos.seekSeconds * 1000)
        } else {
          driftCorrectedRef.current = true
        }
      }
    })

    widget.on('finish', () => {
      if (signal.aborted) return
      // Single-track loop: seekTo(0) alone is a no-op in FINISH state — must also call play()
      widget.seekTo(0)
      widget.play()
    })

    widget.on('error', () => {
      if (signal.aborted) return
      // Track removed or unavailable — could advance here in a future iteration
    })

    // Tab visibility resync — always compute a fresh position, never use stale mount-time value
    const handleVisibility = () => {
      if (!document.hidden && !signal.aborted) {
        driftCorrectedRef.current = false
        const livePos = getSchedulePosition(channelRef.current, new Date())
        widget.seekTo(livePos.seekSeconds * 1000)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      mountToken.abort()
      widget.pause()
      iframe.src = 'about:blank'
      widget.dispose()
      widgetRef.current = null
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, channel.sourceUrl])

  useEffect(() => {
    if (!isMuted && widgetRef.current) {
      widgetRef.current.play()
    }
  }, [isMuted])

  const widgetSrc = buildWidgetSrc(channel.sourceUrl)

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#000',
      }}
    >
      <MusicVisualizerCanvas
        preset={preset}
        trackElapsed={trackElapsed}
        trackProgress={trackProgress}
      />

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
          onClick={onUnmute}
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
          TAP TO UNMUTE
        </button>
      )}

      {/* Hidden audio-only iframe — below viewport so no visible UI */}
      <iframe
        ref={iframeRef}
        src={widgetSrc}
        title={`SoundCloud: ${channel.name}`}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          width: 1,
          height: 1,
        }}
        aria-hidden="true"
      />
    </div>
  )
}

export { SC_WIDGET_ORIGIN }
