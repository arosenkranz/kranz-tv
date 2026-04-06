import { useRef } from 'react'
import { MONO_FONT } from '~/lib/theme'

const GREEN = '#39ff14'
const ORANGE = '#ffa500'

const SHORTCUTS: ReadonlyArray<{ key: string; action: string }> = [
  { key: '↑ / ↓', action: 'Change channels' },
  { key: 'G', action: 'Open the TV Guide' },
  { key: 'I', action: 'Import a YouTube playlist' },
  { key: 'T', action: 'Theater mode (cinematic)' },
  { key: '?', action: 'All keyboard shortcuts' },
] as const

export interface DesktopWelcomeProps {
  readonly visible: boolean
  readonly onDismiss: () => void
}

/**
 * First-visit welcome overlay for desktop users. Shows a brief intro
 * and key shortcuts. Does NOT have its own Esc handler — relies on
 * ChannelView's handleEscape priority chain to avoid double-fire.
 */
export function DesktopWelcome({ visible, onDismiss }: DesktopWelcomeProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  if (!visible) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === backdropRef.current) {
      onDismiss()
    }
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[55] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to KranzTV"
    >
      <div
        className="relative rounded border-2 px-8 py-6"
        style={{
          backgroundColor: '#0d0d0d',
          borderColor: 'rgba(255,165,0,0.7)',
          minWidth: '360px',
          maxWidth: '460px',
          boxShadow: '0 0 30px rgba(255,165,0,0.15)',
        }}
      >
        {/* Header */}
        <h2
          className="mb-1 font-mono text-2xl tracking-widest uppercase text-center"
          style={{ color: ORANGE, fontFamily: MONO_FONT }}
        >
          WELCOME TO KRANZTV
        </h2>
        <p
          className="mb-6 font-mono text-sm tracking-wider text-center"
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontFamily: MONO_FONT,
          }}
        >
          RETRO CABLE TV — LIVE-SCHEDULED YOUTUBE CHANNELS
        </p>

        {/* Shortcut list */}
        <table className="w-full mb-6">
          <tbody>
            {SHORTCUTS.map(({ key, action }) => (
              <tr
                key={key}
                className="border-b"
                style={{ borderColor: 'rgba(255,165,0,0.1)' }}
              >
                <td
                  className="py-2 pr-6 font-mono text-base tracking-widest"
                  style={{
                    color: GREEN,
                    fontFamily: MONO_FONT,
                    minWidth: '80px',
                  }}
                >
                  {key}
                </td>
                <td
                  className="py-2 font-mono text-base tracking-wider"
                  style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontFamily: MONO_FONT,
                  }}
                >
                  {action}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Start button */}
        <button
          onClick={onDismiss}
          className="w-full rounded border py-3 font-mono text-lg tracking-widest uppercase"
          style={{
            backgroundColor: 'rgba(57,255,20,0.1)',
            borderColor: 'rgba(57,255,20,0.5)',
            color: GREEN,
            fontFamily: MONO_FONT,
            cursor: 'pointer',
          }}
          aria-label="Start watching"
        >
          START WATCHING
        </button>

        {/* Footer */}
        <p
          className="mt-4 font-mono text-xs tracking-wider text-center"
          style={{
            color: 'rgba(255,255,255,0.2)',
            fontFamily: MONO_FONT,
          }}
        >
          PRESS ESC TO DISMISS
        </p>
      </div>
    </div>
  )
}
