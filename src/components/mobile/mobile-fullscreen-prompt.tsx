import { MONO_FONT } from '~/lib/theme'

interface MobileFullscreenPromptProps {
  readonly visible: boolean
  readonly onTap: () => void
  readonly onDismiss: () => void
}

export function MobileFullscreenPrompt({
  visible,
  onTap,
  onDismiss,
}: MobileFullscreenPromptProps) {
  if (!visible) return null

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3"
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
    >
      <button
        type="button"
        onClick={onTap}
        className="rounded-lg border px-6 py-3 font-mono text-base tracking-widest"
        style={{
          backgroundColor: 'rgba(0,0,0,0.8)',
          borderColor: 'rgba(57,255,20,0.4)',
          color: '#39ff14',
          fontFamily: MONO_FONT,
          WebkitTapHighlightColor: 'transparent',
        }}
        aria-label="Tap for fullscreen"
      >
        TAP FOR FULLSCREEN
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="font-mono text-xs tracking-widest"
        style={{
          color: 'rgba(255,255,255,0.3)',
          fontFamily: MONO_FONT,
          backgroundColor: 'transparent',
          border: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
        aria-label="Dismiss fullscreen prompt"
      >
        DISMISS
      </button>
    </div>
  )
}
