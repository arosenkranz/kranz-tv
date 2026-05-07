import React, { useEffect, useRef, useState, useCallback } from 'react'
import type {
  MusicChannel,
  SchedulePosition,
  Track,
} from '~/lib/scheduling/types'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import { NowPlayingCard } from './now-playing-card'
import {
  buildWidgetSrc,
  SoundCloudWidgetWrapper,
  SC_WIDGET_ORIGIN,
} from '~/lib/sources/soundcloud/widget'

const DRIFT_THRESHOLD_SECONDS = 3

interface Props {
  channel: MusicChannel
  position: SchedulePosition
  isMuted: boolean
  volume: number
  onUnmute: () => void
}

export function MusicChannelView({
  channel,
  position,
  isMuted,
  volume,
  onUnmute,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const widgetRef = useRef<SoundCloudWidgetWrapper | null>(null)
  const mountTokenRef = useRef<AbortController | null>(null)
  const driftCorrectedRef = useRef(false)
  const [trackElapsed, setTrackElapsed] = useState(0)
  const [widgetStatus, setWidgetStatus] = useState<
    'mounting' | 'ready' | 'playing' | 'paused' | 'error'
  >('mounting')
  const currentTrack = position.item as Track
  const durationSeconds = currentTrack.durationSeconds

  // Allow visual debugging of the SC iframe via ?debug-sc=1 query param
  const debugIframe =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debug-sc')

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
      // Volume is 0–1 from the app; SC widget API takes 0–100
      widget.setVolume(isMuted ? 0 : Math.round(volume * 100))
      if (!isMuted) widget.play()
    },
    [isMuted, volume],
  )

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !channel.tracks?.length) return

    const mountToken = new AbortController()
    mountTokenRef.current = mountToken
    const { signal } = mountToken

    // Set src imperatively so we control exactly when navigation begins.
    // React's declarative src prop on iframe creates timing races where
    // the wrapper sees the iframe before navigation has actually started.
    const targetSrc = buildWidgetSrc(channel.sourceUrl)
    iframe.src = targetSrc

    const widget = new SoundCloudWidgetWrapper(iframe)
    widgetRef.current = widget

    widget.on('ready', () => {
      if (signal.aborted) return
      setWidgetStatus('ready')
      handleReady(widget, signal)
    })
    widget.on('play', () => {
      if (!signal.aborted) setWidgetStatus('playing')
    })
    widget.on('pause', () => {
      if (!signal.aborted) setWidgetStatus('paused')
    })

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

    // Tab visibility resync — let the next playProgress event handle drift.
    // Don't call seekTo unconditionally; that causes audible stutters when
    // the tab returns and audio was already in sync. Resetting the flag means
    // the playProgress handler will re-check drift once and seek only if needed.
    const handleVisibility = () => {
      if (!document.hidden && !signal.aborted) {
        driftCorrectedRef.current = false
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      mountToken.abort()
      // Order matters: pause + dispose first (while iframe is still on the SC
      // origin), then clear src. Clearing src first sends the iframe to
      // about:blank which makes every subsequent unbind/postMessage throw.
      widget.pause()
      widget.dispose()
      iframe.src = 'about:blank'
      widgetRef.current = null
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    // Re-mount when channel changes OR when tracks arrive async after initial render.
    // tracks.length is the stable signal — array identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, channel.sourceUrl, channel.tracks?.length ?? 0])

  // Mute/unmute: pause-vs-play is a hard transition tied to isMuted.
  useEffect(() => {
    const widget = widgetRef.current
    if (!widget) return
    if (isMuted) {
      widget.setVolume(0)
      widget.pause()
    } else {
      widget.play()
    }
  }, [isMuted])

  // Volume changes: only adjust volume — never call play() here, which would
  // cause stutters when the user nudges the volume slider mid-playback.
  useEffect(() => {
    const widget = widgetRef.current
    if (!widget || isMuted) return
    widget.setVolume(Math.round(volume * 100))
  }, [volume, isMuted])

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

      {/* Widget status badge — surfaces the underlying SC widget state so
          the user can tell if audio is loading, ready, playing, or stuck. */}
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
            widgetStatus === 'playing'
              ? '#39ff14'
              : widgetStatus === 'ready'
                ? '#ffaa00'
                : widgetStatus === 'error'
                  ? '#ff3333'
                  : 'rgba(255,255,255,0.6)',
          background: 'rgba(0,0,0,0.6)',
          padding: '4px 10px',
          borderRadius: 2,
          textTransform: 'uppercase',
        }}
      >
        ● {widgetStatus}
      </div>

      {isMuted && (
        <button
          onClick={() => {
            // Call play() synchronously inside the user gesture — browsers
            // won't honor an autoplay attempt that happens after a state-update
            // round-trip.
            const widget = widgetRef.current
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
          {widgetStatus === 'mounting'
            ? 'LOADING… TAP TO UNMUTE'
            : 'TAP TO UNMUTE'}
        </button>
      )}

      {/* SoundCloud widget iframe — kept at real size but visually hidden.
          1x1 / off-viewport iframes can be blocked by anti-tracking heuristics
          and the SC widget's internal init can stall in zero-size containers.
          src is set imperatively in the effect so we control timing. */}
      <iframe
        ref={iframeRef}
        title={`SoundCloud: ${channel.name}`}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: debugIframe ? 480 : 320,
          height: debugIframe ? 160 : 80,
          opacity: debugIframe ? 1 : 0,
          pointerEvents: debugIframe ? 'auto' : 'none',
          zIndex: debugIframe ? 100 : -1,
          border: debugIframe ? '2px solid #ff5500' : 'none',
        }}
        aria-hidden={!debugIframe}
      />
    </div>
  )
}

export { SC_WIDGET_ORIGIN }
