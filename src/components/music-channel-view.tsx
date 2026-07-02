import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  MusicChannel,
  SchedulePosition,
  Track,
} from '~/lib/scheduling/types'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import { NowPlayingCard } from './now-playing-card'
import { useScWidget } from '~/lib/sources/soundcloud/sc-widget-context'
import { VisualizerHost } from './visualizer-host'
import { TuningOverlay } from '~/components/tuning-overlay'
import type { VisualizerPreset, IntensityLevel } from '~/lib/visualizers/types'
import { trackMusicVisualizerStart, trackMusicVisualizerFallback, trackMobileScAutoplay } from '~/lib/datadog/rum'

const DRIFT_THRESHOLD_SECONDS = 8
const HIDDEN_DRIFT_RESET_MS = 30_000

interface Props {
  channel: MusicChannel
  /**
   * Live schedule position, or null while the channel's playlist is still
   * resolving. Null renders loading mode: the visualizer idles behind the
   * TUNING overlay with all track-dependent UI (now-playing card, status
   * badge, unmute button) hidden — the widget isn't pointed at this channel
   * yet, so those would reflect a previous channel's state.
   */
  position: SchedulePosition | null
  isMuted: boolean
  volume: number
  onUnmute: () => void
  activePreset?: VisualizerPreset
  activeIntensity?: IntensityLevel
  isMobile?: boolean
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
  activePreset = 'spectrum',
  activeIntensity = 'normal',
  isMobile = false,
}: Props) {
  const { widget, status, activeChannelId } = useScWidget()
  const [trackElapsed, setTrackElapsed] = useState(0)
  const [hasFallback, setHasFallback] = useState(false)
  const driftCorrectedRef = useRef(false)
  const hiddenAtRef = useRef<number | null>(null)
  const channelRef = useRef(channel)
  channelRef.current = channel
  const currentTrack = position === null ? null : (position.item as Track)
  const durationSeconds = currentTrack?.durationSeconds ?? 0

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
      // Loading mode: the channel is a track-less stub, so progress events
      // belong to whatever the shared widget was playing before. Deriving a
      // schedule position from an empty channel (or drift-seeking another
      // channel's track) would be nonsense — ignore until real data arrives.
      if ((channelRef.current.tracks?.length ?? 0) === 0) return

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

  // Reset drift flag when tab regains visibility after >30s hidden.
  // Short focus switches (alt-tab, IDE) don't need drift correction
  // and the 8s threshold already filters normal variance.
  useEffect(() => {
    const onVis = (): void => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now()
      } else {
        const hiddenAt = hiddenAtRef.current
        hiddenAtRef.current = null
        if (hiddenAt !== null && Date.now() - hiddenAt > HIDDEN_DRIFT_RESET_MS) {
          driftCorrectedRef.current = false
        }
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const handleVizStart = useCallback(
    (preset: VisualizerPreset) => {
      trackMusicVisualizerStart(preset, isMobile ? 'mobile' : 'desktop')
    },
    [isMobile],
  )

  const handleVizFallback = useCallback(
    (reason: 'webgl2-unavailable' | 'context-lost') => {
      setHasFallback(true)
      trackMusicVisualizerFallback(reason)
    },
    [],
  )

  // Auto-play when the channel is ready and the browser has a prior user activation.
  // This removes the need for a tap on subsequent channel visits within a session.
  useEffect(() => {
    if (!widget || isMuted) return
    if (activeChannelId !== channel.id || status !== 'ready') return
    if (navigator.userActivation.isActive) {
      widget.setVolume(volume)
      widget.play()
      trackMobileScAutoplay(true)
    } else {
      trackMobileScAutoplay(false)
    }
  }, [widget, activeChannelId, channel.id, status, isMuted, volume])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#000',
      }}
    >
      {hasFallback ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at 30% 40%, #1a0a2e 0%, #0d0d1a 50%, #000 100%)',
            zIndex: 1,
          }}
        />
      ) : (
        <VisualizerHost
          preset={activePreset}
          intensity={activeIntensity}
          trackElapsed={trackElapsed}
          trackProgress={durationSeconds > 0 ? trackElapsed / durationSeconds : 0}
          onStart={handleVizStart}
          onFallback={handleVizFallback}
        />
      )}

      <TuningOverlay
        channelNumber={channel.number}
        channelName={channel.name}
        isActiveChannel={activeChannelId === channel.id}
        status={status}
        // While the playlist resolves, thin the static so the idle visualizer
        // reads clearly behind the RESOLVING SIGNAL label instead of a wall
        // of noise. Full strength once real data drives the lock-in phase.
        staticOpacity={position === null ? 0.35 : 0.7}
      />

      {position !== null && (
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
      )}

      {currentTrack !== null && (
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
      )}

      {isMuted && position !== null && (
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
            // Above the TUNING overlay (zIndex 25, inner label 26) so the
            // unmute call-to-action stays readable over the static during a
            // muted load on strict-autoplay browsers.
            zIndex: 27,
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
    </div>
  )
}

export { SC_WIDGET_ORIGIN } from '~/lib/sources/soundcloud/widget'
