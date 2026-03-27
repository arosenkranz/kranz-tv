import { useState, useEffect, useRef } from 'react'
import { Volume2, VolumeX, List, X, Play } from 'lucide-react'
import { TvPlayer } from '~/components/tv-player'
import { MobileGuideRow } from '~/components/remote-control/mobile-guide-row'
import { overlayClassName } from '~/lib/overlays'
import type { ChannelPreset } from '~/lib/channels/types'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'
import type { OverlayMode } from '~/lib/overlays'

interface MobileViewProps {
  channel: Channel
  position: SchedulePosition
  isMuted: boolean
  volume: number
  onToggleMute: () => void
  onVolumeChange: (v: number) => void
  onPlay: () => void
  onChannelSelect: (id: string) => void
  onResync: () => void
  showStatic: boolean
  overlayMode: OverlayMode
  allPresets: ChannelPreset[]
  loadedChannels: Map<string, Channel>
  currentChannelId: string
}

const MONO = "'VT323', 'Courier New', monospace"

export function MobileView({
  channel,
  position,
  isMuted,
  volume,
  onToggleMute,
  onVolumeChange,
  onPlay,
  onChannelSelect,
  onResync,
  showStatic,
  overlayMode,
  allPresets,
  loadedChannels,
  currentChannelId,
}: MobileViewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [guideVisible, setGuideVisible] = useState(true)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const sliderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset to poster state when channel changes
  useEffect(() => {
    setIsPlaying(false)
    setShowVolumeSlider(false)
  }, [channel.id])

  // Cleanup slider auto-hide timer on unmount
  useEffect(() => {
    return () => {
      if (sliderTimerRef.current !== null) clearTimeout(sliderTimerRef.current)
    }
  }, [])

  const resetSliderTimer = (): void => {
    if (sliderTimerRef.current !== null) clearTimeout(sliderTimerRef.current)
    sliderTimerRef.current = setTimeout(() => setShowVolumeSlider(false), 3000)
  }

  const overlayClass =
    overlayMode !== 'none' ? overlayClassName(overlayMode) : ''

  const thumbnailUrl =
    position.video.thumbnailUrl ||
    `https://img.youtube.com/vi/${position.video.id}/hqdefault.jpg`

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-black">
      {/* Player area — fixed height when guide visible, fills remaining space when hidden */}
      <div
        className={`relative overflow-hidden ${guideVisible ? 'shrink-0' : 'flex-1'}`}
        style={guideVisible ? { height: '40vh' } : undefined}
      >
        {isPlaying ? (
          <>
            {/* isMuted is synced from parent — TvPlayer's mute useEffect handles unmute
                only when user taps the mute button (a real gesture), avoiding
                the NotAllowedError from async unMute() outside the gesture window. */}
            <TvPlayer
              channel={channel}
              position={position}
              isMuted={isMuted}
              volume={volume}
              onNeedsInteraction={() => {}}
              onResync={onResync}
              allowInteraction
            />
            {overlayClass && (
              <div
                className={overlayClass}
                aria-hidden="true"
                style={{ pointerEvents: 'none' }}
              />
            )}
            {showStatic && (
              <div
                className="static-burst absolute inset-0 pointer-events-none"
                aria-hidden="true"
                style={{ zIndex: 10 }}
              />
            )}
            {/* Muted badge */}
            {isMuted && (
              <div
                className="absolute top-2 right-2 rounded border px-2 py-0.5 font-mono text-xs tracking-widest"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  borderColor: 'rgba(255,165,0,0.5)',
                  color: 'rgba(255,165,0,0.9)',
                  fontFamily: MONO,
                }}
              >
                MUTED
              </div>
            )}
          </>
        ) : (
          /* Poster state — thumbnail + play button */
          <div className="relative h-full w-full">
            <img
              src={thumbnailUrl}
              alt={position.video.title}
              className="h-full w-full"
              style={{ objectFit: 'cover' }}
            />
            {/* Dark scrim */}
            <div
              className="absolute inset-0"
              style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            />
            {/* Play button */}
            <button
              type="button"
              onClick={() => {
                onPlay()
                setIsPlaying(true)
              }}
              className="absolute inset-0 flex items-center justify-center"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              aria-label="Play"
            >
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 72,
                  height: 72,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  border: '2px solid rgba(57,255,20,0.8)',
                }}
              >
                <Play size={32} color="#39ff14" fill="#39ff14" />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Now-playing bar (56px, always visible) */}
      <div
        className="shrink-0 flex items-center justify-between px-4"
        style={{
          height: 56,
          backgroundColor: '#0d0d0d',
          borderBottom: '1px solid rgba(57,255,20,0.12)',
        }}
      >
        <div className="min-w-0 flex-1">
          <div
            className="font-mono text-sm tracking-widest truncate"
            style={{ color: '#39ff14', fontFamily: MONO }}
          >
            CH{String(channel.number).padStart(2, '0')} —{' '}
            {channel.name.toUpperCase()}
          </div>
          <div
            className="font-mono text-xs tracking-wider truncate"
            style={{ color: 'rgba(255,165,0,0.85)', fontFamily: MONO }}
          >
            {position.video.title}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 ml-3">
          {/* Inline volume slider — shown when toggled */}
          {showVolumeSlider && (
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              aria-label="Volume"
              onChange={(e) => {
                onVolumeChange(Number(e.target.value))
                resetSliderTimer()
              }}
              style={{
                width: '72px',
                height: '4px',
                accentColor: '#39ff14',
                cursor: 'pointer',
                opacity: isMuted ? 0.5 : 1,
              }}
            />
          )}
          {/* Volume icon — toggles slider */}
          <button
            type="button"
            onClick={() => {
              setShowVolumeSlider((v) => {
                if (!v) resetSliderTimer()
                return !v
              })
            }}
            className="rounded p-2"
            style={{
              color: showVolumeSlider
                ? 'rgba(57,255,20,0.9)'
                : 'rgba(255,255,255,0.4)',
              backgroundColor: 'transparent',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label="Toggle volume slider"
          >
            <Volume2 size={18} />
          </button>
          {/* Mute toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            className="rounded p-2"
            style={{
              color: isMuted ? 'rgba(255,165,0,0.9)' : 'rgba(255,255,255,0.6)',
              backgroundColor: 'transparent',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          {/* Guide toggle */}
          <button
            type="button"
            onClick={() => setGuideVisible((v) => !v)}
            className="rounded p-2"
            style={{
              color: guideVisible
                ? 'rgba(57,255,20,0.9)'
                : 'rgba(255,255,255,0.4)',
              backgroundColor: 'transparent',
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label={guideVisible ? 'Hide guide' : 'Show guide'}
          >
            {guideVisible ? <X size={20} /> : <List size={20} />}
          </button>
        </div>
      </div>

      {/* Scrollable channel list (toggleable) */}
      {guideVisible && (
        <div className="flex-1 overflow-y-auto">
          {allPresets.map((preset) => (
            <MobileGuideRow
              key={preset.id}
              preset={preset}
              loadedChannel={loadedChannels.get(preset.id)}
              isActive={preset.id === currentChannelId}
              onSelect={onChannelSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
