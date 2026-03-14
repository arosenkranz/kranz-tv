import { useRef } from 'react'
import {
  Volume2,
  VolumeX,
  LayoutGrid,
  Info,
  Download,
  Home,
  Maximize,
  Monitor,
} from 'lucide-react'
import { ChannelButton } from '~/components/remote-control/channel-button'
import { ControlButton } from '~/components/remote-control/control-button'
import { NowPlayingBar } from '~/components/remote-control/now-playing-bar'
import { MobileGuide } from '~/components/remote-control/mobile-guide'
import { TvPlayer } from '~/components/tv-player'
import { useTouchControls } from '~/hooks/use-touch-controls'
import { supportsFullscreen } from '~/lib/utils/supports-fullscreen'
import type { ChannelPreset } from '~/lib/channels/types'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'
import type { OverlayMode } from '~/lib/overlays'
import { overlayClassName } from '~/lib/overlays'

interface MobileChannelLayoutProps {
  channel: Channel
  position: SchedulePosition
  isMuted: boolean
  onToggleMute: () => void
  needsInteraction: boolean
  onNeedsInteraction: () => void
  showInfo: boolean
  onToggleInfo: () => void
  guideVisible: boolean
  onToggleGuide: () => void
  overlayMode: OverlayMode
  onCycleOverlay: () => void
  onToggleImport: () => void
  onToggleFullscreen: () => void
  onHome: () => void
  onChannelUp: () => void
  onChannelDown: () => void
  onChannelSelect: (id: string) => void
  onResync: () => void
  showStatic: boolean
  allPresets: ChannelPreset[]
  loadedChannels: Map<string, Channel>
  currentChannelId: string | null
  currentPreset: ChannelPreset | undefined
}

const MONO = "'VT323', 'Courier New', monospace"

export function MobileChannelLayout({
  channel,
  position,
  isMuted,
  onToggleMute,
  needsInteraction,
  onNeedsInteraction,
  showInfo,
  onToggleInfo,
  guideVisible,
  onToggleGuide,
  overlayMode,
  onCycleOverlay,
  onToggleImport,
  onToggleFullscreen,
  onHome,
  onChannelUp,
  onChannelDown,
  onChannelSelect,
  onResync,
  showStatic,
  allPresets,
  loadedChannels,
  currentChannelId,
  currentPreset,
}: MobileChannelLayoutProps) {
  const dpadRef = useRef<HTMLDivElement>(null)

  useTouchControls(dpadRef, {
    onChannelUp,
    onChannelDown,
    onToggleGuide,
    onToggleMute,
  })

  const handleGuideSelect = (id: string): void => {
    onChannelSelect(id)
    onToggleGuide()
  }

  const overlayClass = overlayMode !== 'none' ? overlayClassName(overlayMode) : ''

  return (
    <div className="remote-view flex h-screen w-screen flex-col overflow-hidden bg-black">
      {/* Mini player (~30vh) */}
      <div className="relative shrink-0 overflow-hidden" style={{ height: '30vh' }}>
        <TvPlayer
          channel={channel}
          position={position}
          isMuted={isMuted}
          onNeedsInteraction={onNeedsInteraction}
          onResync={onResync}
        />
        {overlayClass && <div className={overlayClass} aria-hidden="true" />}
        {/* Static burst overlay */}
        {showStatic && (
          <div
            className="static-burst absolute inset-0 pointer-events-none"
            aria-hidden="true"
            style={{ zIndex: 10 }}
          />
        )}
        {/* Autoplay blocked prompt */}
        {needsInteraction && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-auto"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 60 }}
            onClick={onToggleMute}
          >
            <span
              className="font-mono text-lg tracking-widest"
              style={{ color: '#39ff14', fontFamily: MONO }}
            >
              TAP TO UNMUTE
            </span>
          </div>
        )}
        {/* Muted badge */}
        {isMuted && !needsInteraction && (
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
      </div>

      {/* Now-playing bar */}
      <NowPlayingBar
        position={position}
        preset={currentPreset}
        onToggleInfo={onToggleInfo}
      />

      {/* Info overlay — shown when showInfo is true */}
      {showInfo && (
        <div
          className="absolute top-[30vh] left-0 right-0 z-40 mx-2 mt-1 rounded border px-4 py-3"
          style={{
            backgroundColor: 'rgba(0,0,0,0.9)',
            borderColor: 'rgba(57,255,20,0.4)',
          }}
        >
          <div
            className="font-mono text-lg tracking-widest"
            style={{ color: '#39ff14', fontFamily: MONO }}
          >
            CH {channel.number} — {channel.name.toUpperCase()}
          </div>
          <div
            className="mt-1 font-mono text-sm tracking-wider"
            style={{ color: 'rgba(255,165,0,0.9)', fontFamily: MONO }}
          >
            {position.video.title}
          </div>
          <div className="mt-2 flex gap-4">
            <a
              href={`https://www.youtube.com/watch?v=${position.video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs tracking-wider underline"
              style={{ color: 'rgba(255,255,255,0.45)', fontFamily: MONO }}
            >
              ▶ WATCH ON YOUTUBE
            </a>
            {channel.playlistId && (
              <a
                href={`https://www.youtube.com/playlist?list=${channel.playlistId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs tracking-wider underline"
                style={{ color: 'rgba(255,255,255,0.45)', fontFamily: MONO }}
              >
                ☰ VIEW PLAYLIST
              </a>
            )}
          </div>
        </div>
      )}

      {/* D-pad control area */}
      <div
        ref={dpadRef}
        className="flex flex-1 flex-col items-center justify-between px-4 py-4"
        style={{ minHeight: 0 }}
      >
        <ChannelButton direction="up" onPress={onChannelUp} />

        {/* Center row: MUTE — GUIDE — INFO */}
        <div className="flex w-full items-center justify-around py-2">
          <ControlButton
            icon={needsInteraction ? Volume2 : isMuted ? VolumeX : Volume2}
            label={needsInteraction ? 'TAP!' : isMuted ? 'Unmute' : 'Mute'}
            isActive={needsInteraction || isMuted}
            onPress={onToggleMute}
          />
          <ControlButton
            icon={LayoutGrid}
            label="Guide"
            isActive={guideVisible}
            onPress={onToggleGuide}
            size="lg"
          />
          <ControlButton
            icon={Info}
            label="Info"
            isActive={showInfo}
            onPress={onToggleInfo}
          />
        </div>

        <ChannelButton direction="down" onPress={onChannelDown} />
      </div>

      {/* Bottom action bar */}
      <div
        className="remote-panel shrink-0 flex items-center justify-around border-t px-4 py-3"
        style={{
          borderColor: 'rgba(57,255,20,0.15)',
          backgroundColor: '#0d0d0d',
          minHeight: 64,
        }}
      >
        <ControlButton icon={Home} label="Home" onPress={onHome} size="sm" />
        <ControlButton icon={Download} label="Import" onPress={onToggleImport} size="sm" />
        <ControlButton icon={Monitor} label="Overlay" onPress={onCycleOverlay} size="sm" />
        {supportsFullscreen() && (
          <ControlButton icon={Maximize} label="Full" onPress={onToggleFullscreen} size="sm" />
        )}
      </div>

      {/* Mobile guide bottom sheet */}
      <MobileGuide
        visible={guideVisible}
        allPresets={allPresets}
        loadedChannels={loadedChannels}
        currentChannelId={currentChannelId ?? ''}
        onChannelSelect={handleGuideSelect}
        onClose={onToggleGuide}
      />
    </div>
  )
}
