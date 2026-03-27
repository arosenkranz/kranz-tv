import { useEffect, useRef } from 'react'

export interface KeyboardHelpProps {
  visible: boolean
  onClose: () => void
}

const TROUBLESHOOTING_ITEMS: ReadonlyArray<{ symptom: string; fix: string }> = [
  {
    symptom: 'Video stuck loading / black screen',
    fix: 'Ad blocker detected. Allowlist kranz.tv and youtube.com, then reload.',
  },
  {
    symptom: 'Channels show but no program data',
    fix: 'YouTube API quota may be exhausted. Resets daily at midnight PT.',
  },
] as const

const KEY_BINDINGS: ReadonlyArray<{ key: string; action: string }> = [
  { key: '↑ / ↓', action: 'Change channel' },
  { key: 'G', action: 'Toggle TV Guide overlay' },
  { key: '↑ / ↓ (in guide)', action: 'Browse channels' },
  { key: 'Enter (in guide)', action: 'Tune to channel' },
  { key: 'M', action: 'Mute / unmute' },
  { key: '. / ,', action: 'Volume up / down' },
  { key: 'N', action: 'Now playing info' },
  { key: 'I', action: 'Import channel' },
  { key: 'H', action: 'Go home' },
  { key: 'F', action: 'Toggle fullscreen' },
  { key: 'T', action: 'Theater mode' },
  { key: 'S', action: 'Copy share link' },
  { key: 'V', action: 'Cycle overlay (CRT/VHS/Amber/Green/None)' },
  { key: '?', action: 'Keyboard shortcuts' },
  { key: 'Esc', action: 'Close modal' },
] as const

export function KeyboardHelp({ visible, onClose }: KeyboardHelpProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible, onClose])

  if (!visible) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === backdropRef.current) {
      onClose()
    }
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="relative rounded border-2 px-8 py-6"
        style={{
          backgroundColor: '#0d0d0d',
          borderColor: 'rgba(255,165,0,0.7)',
          minWidth: '360px',
          boxShadow: '0 0 30px rgba(255,165,0,0.15)',
        }}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2
            className="font-mono text-xl tracking-widest uppercase"
            style={{
              color: '#ffa500',
              fontFamily: "'VT323', 'Courier New', monospace",
            }}
          >
            KEYBOARD SHORTCUTS
          </h2>
          <button
            onClick={onClose}
            className="font-mono text-sm tracking-widest"
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontFamily: "'VT323', 'Courier New', monospace",
            }}
            aria-label="Close keyboard shortcuts"
          >
            [ESC]
          </button>
        </div>

        {/* Key binding table */}
        <table className="w-full">
          <tbody>
            {KEY_BINDINGS.map(({ key, action }) => (
              <tr
                key={key}
                className="border-b"
                style={{ borderColor: 'rgba(255,165,0,0.1)' }}
              >
                <td
                  className="py-2 pr-6 font-mono text-base tracking-widest"
                  style={{
                    color: '#39ff14',
                    fontFamily: "'VT323', 'Courier New', monospace",
                    minWidth: '80px',
                  }}
                >
                  {key}
                </td>
                <td
                  className="py-2 font-mono text-base tracking-wider"
                  style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontFamily: "'VT323', 'Courier New', monospace",
                  }}
                >
                  {action}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Troubleshooting */}
        <div
          className="mt-5 border-t pt-4"
          style={{ borderColor: 'rgba(255,165,0,0.2)' }}
        >
          <p
            className="mb-3 font-mono text-base tracking-widest uppercase"
            style={{
              color: '#ffa500',
              fontFamily: "'VT323', 'Courier New', monospace",
            }}
          >
            TROUBLESHOOTING
          </p>
          <div className="space-y-2">
            {TROUBLESHOOTING_ITEMS.map(({ symptom, fix }) => (
              <div key={symptom}>
                <p
                  className="font-mono text-sm tracking-wide"
                  style={{
                    color: '#39ff14',
                    fontFamily: "'VT323', 'Courier New', monospace",
                  }}
                >
                  {symptom}
                </p>
                <p
                  className="font-mono text-sm tracking-wide"
                  style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontFamily: "'VT323', 'Courier New', monospace",
                  }}
                >
                  {fix}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p
          className="mt-5 font-mono text-xs tracking-wider text-center"
          style={{
            color: 'rgba(255,255,255,0.2)',
            fontFamily: "'VT323', 'Courier New', monospace",
          }}
        >
          CLICK OUTSIDE OR PRESS ESC TO CLOSE
        </p>
      </div>
    </div>
  )
}
