import {
  Volume2,
  VolumeX,
  Share2,
  Monitor,
  Info,
  Maximize,
  HelpCircle,
} from 'lucide-react'
import { vibrate } from '~/lib/haptic'
import type { OverlayMode } from '~/lib/overlays'

interface MobileToolbarProps {
  readonly isMuted: boolean
  readonly overlayMode: OverlayMode
  readonly onToggleMute: () => void
  readonly onShare: () => void
  readonly onCycleOverlay: () => void
  readonly onToggleInfo: () => void
  readonly onFullscreen: () => void
  readonly onHelp: () => void
}

interface ToolbarButtonProps {
  readonly icon: React.ReactNode
  readonly label: string
  readonly onTap: () => void
  readonly active?: boolean
}

function ToolbarButton({ icon, label, onTap, active = false }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        vibrate()
        onTap()
      }}
      className="flex flex-1 items-center justify-center control-press"
      style={{
        minWidth: 44,
        minHeight: 44,
        color: active ? 'rgba(57,255,20,0.9)' : 'rgba(255,255,255,0.45)',
        backgroundColor: 'transparent',
        WebkitTapHighlightColor: 'transparent',
      }}
      aria-label={label}
    >
      {icon}
    </button>
  )
}

export function MobileToolbar({
  isMuted,
  overlayMode,
  onToggleMute,
  onShare,
  onCycleOverlay,
  onToggleInfo,
  onFullscreen,
  onHelp,
}: MobileToolbarProps) {
  return (
    <div
      className="shrink-0 flex items-center"
      style={{
        backgroundColor: '#0d0d0d',
        borderTop: '1px solid rgba(57,255,20,0.08)',
        borderBottom: '1px solid rgba(57,255,20,0.08)',
        height: 48,
      }}
    >
      <ToolbarButton
        icon={isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        label={isMuted ? 'Unmute' : 'Mute'}
        onTap={onToggleMute}
        active={isMuted}
      />
      <ToolbarButton
        icon={<Share2 size={18} />}
        label="Share link"
        onTap={onShare}
      />
      <ToolbarButton
        icon={<Monitor size={18} />}
        label={`Overlay: ${overlayMode}`}
        onTap={onCycleOverlay}
        active={overlayMode !== 'none'}
      />
      <ToolbarButton
        icon={<Info size={18} />}
        label="Now playing info"
        onTap={onToggleInfo}
      />
      <ToolbarButton
        icon={<Maximize size={18} />}
        label="Fullscreen"
        onTap={onFullscreen}
      />
      <ToolbarButton
        icon={<HelpCircle size={18} />}
        label="Help"
        onTap={onHelp}
      />
    </div>
  )
}
