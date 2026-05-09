import { ArrowUpDown, Hand, ChevronUp, RotateCcw, Grip } from 'lucide-react'
import { MONO_FONT } from '~/lib/theme'

interface MobileHelpOverlayProps {
  readonly visible: boolean
  readonly onDismiss: () => void
}

interface HelpItemProps {
  readonly icon: React.ReactNode
  readonly label: string
  readonly description: string
}

function HelpItem({ icon, label, description }: HelpItemProps) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div
        className="flex shrink-0 items-center justify-center rounded-lg"
        style={{
          width: 44,
          height: 44,
          backgroundColor: 'rgba(57,255,20,0.08)',
          border: '1px solid rgba(57,255,20,0.2)',
          color: '#39ff14',
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="font-mono text-sm tracking-widest uppercase"
          style={{ color: '#39ff14', fontFamily: MONO_FONT }}
        >
          {label}
        </div>
        <div
          className="font-mono text-xs tracking-wider"
          style={{ color: 'rgba(255,255,255,0.5)', fontFamily: MONO_FONT }}
        >
          {description}
        </div>
      </div>
    </div>
  )
}

export function MobileHelpOverlay({
  visible,
  onDismiss,
}: MobileHelpOverlayProps) {
  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.88)' }}
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Mobile controls help"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border px-5 py-5"
        style={{
          backgroundColor: '#0a0a0a',
          borderColor: 'rgba(255,165,0,0.4)',
          boxShadow: '0 0 40px rgba(255,165,0,0.1)',
        }}
      >
        {/* Header */}
        <h2
          className="mb-4 text-center font-mono text-lg tracking-widest uppercase"
          style={{ color: '#ffa500', fontFamily: MONO_FONT }}
        >
          CONTROLS
        </h2>

        {/* Help items */}
        <div
          className="divide-y"
          style={{ borderColor: 'rgba(255,165,0,0.1)' }}
        >
          <HelpItem
            icon={<ArrowUpDown size={20} />}
            label="Swipe up / down"
            description="Change channels"
          />
          <HelpItem
            icon={<Hand size={20} />}
            label="Tap now playing"
            description="Open the program guide"
          />
          <HelpItem
            icon={<ChevronUp size={20} />}
            label="Pull up guide"
            description="Drag the bar at the bottom"
          />
          <HelpItem
            icon={<Grip size={20} />}
            label="Toolbar"
            description="Mute, share, overlay, info, fullscreen"
          />
          <HelpItem
            icon={<RotateCcw size={20} />}
            label="Rotate device"
            description="Landscape triggers fullscreen"
          />
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 w-full rounded-lg py-3 font-mono text-base tracking-widest uppercase"
          style={{
            backgroundColor: 'rgba(57,255,20,0.1)',
            border: '1px solid rgba(57,255,20,0.3)',
            color: '#39ff14',
            fontFamily: MONO_FONT,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          GOT IT
        </button>
      </div>
    </div>
  )
}
