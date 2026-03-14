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
import { useTouchControls } from '~/hooks/use-touch-controls'
import { useTvLayout } from '~/routes/_tv'
import type { ChannelPreset } from '~/lib/channels/types'
import type { Channel } from '~/lib/scheduling/types'

interface RemotePanelProps {
  onChannelUp: () => void
  onChannelDown: () => void
  guideVisible: boolean
  onToggleGuide: () => void
  isMuted: boolean
  onToggleMute: () => void
  showInfo: boolean
  onToggleInfo: () => void
  onToggleImport: () => void
  onToggleFullscreen: () => void
  onHome: () => void
  onCycleOverlay: () => void
  onChannelSelect: (id: string) => void
  allPresets: ChannelPreset[]
  loadedChannels: Map<string, Channel>
  currentChannelId: string | null
  overlayClass: string
  children: React.ReactNode
}

const MONO = "'VT323', 'Courier New', monospace"

export function RemotePanel({
  onChannelUp,
  onChannelDown,
  guideVisible,
  onToggleGuide,
  isMuted,
  onToggleMute,
  showInfo,
  onToggleInfo,
  onToggleImport,
  onToggleFullscreen,
  onHome,
  onCycleOverlay,
  onChannelSelect,
  allPresets,
  loadedChannels,
  currentChannelId,
  overlayClass,
  children,
}: RemotePanelProps) {
  const dpadRef = useRef<HTMLDivElement>(null)
  const { currentPosition } = useTvLayout()

  const currentPreset = currentChannelId
    ? allPresets.find((p) => p.id === currentChannelId)
    : undefined

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

  return (
    <div className="remote-view flex h-screen w-screen flex-col overflow-hidden bg-black">
      {/* Mini player (~30vh) */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{ height: '30vh' }}
      >
        {children}
        {overlayClass && (
          <div className={overlayClass} aria-hidden="true" />
        )}
      </div>

      {/* Now-playing bar */}
      <NowPlayingBar
        position={currentPosition}
        preset={currentPreset}
        onToggleInfo={onToggleInfo}
      />

      {/* D-pad control area */}
      <div
        ref={dpadRef}
        className="flex flex-1 flex-col items-center justify-between px-4 py-4"
        style={{ minHeight: 0 }}
      >
        <ChannelButton direction="up" onPress={onChannelUp} />

        {/* Center: MUTE — GUIDE — INFO */}
        <div className="flex w-full items-center justify-around py-2">
          <ControlButton
            icon={isMuted ? VolumeX : Volume2}
            label={isMuted ? 'Unmute' : 'Mute'}
            isActive={isMuted}
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
        <ControlButton
          icon={Download}
          label="Import"
          onPress={onToggleImport}
          size="sm"
        />
        <ControlButton
          icon={Monitor}
          label="Overlay"
          onPress={onCycleOverlay}
          size="sm"
        />
        <ControlButton
          icon={Maximize}
          label="Full"
          onPress={onToggleFullscreen}
          size="sm"
        />
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
