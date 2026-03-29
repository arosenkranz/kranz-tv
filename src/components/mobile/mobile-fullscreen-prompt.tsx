import { useState, useEffect } from 'react'
import { MONO_FONT } from '~/lib/theme'

interface MobileFullscreenPromptProps {
  readonly visible: boolean
  readonly onTap: () => void
}

export function MobileFullscreenPrompt({
  visible,
  onTap,
}: MobileFullscreenPromptProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!visible) {
      setShow(false)
      return
    }

    setShow(true)
    const timer = setTimeout(() => setShow(false), 3000)
    return () => clearTimeout(timer)
  }, [visible])

  if (!show) return null

  return (
    <button
      type="button"
      onClick={onTap}
      className="absolute inset-0 z-30 flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        WebkitTapHighlightColor: 'transparent',
      }}
      aria-label="Tap for fullscreen"
    >
      <div
        className="rounded-lg border px-6 py-3 font-mono text-base tracking-widest"
        style={{
          backgroundColor: 'rgba(0,0,0,0.8)',
          borderColor: 'rgba(57,255,20,0.4)',
          color: '#39ff14',
          fontFamily: MONO_FONT,
        }}
      >
        TAP FOR FULLSCREEN
      </div>
    </button>
  )
}
