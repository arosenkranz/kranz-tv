import { useEffect, useState } from 'react'

interface Props {
  /** Phase labels shown during boot — most recent at the bottom. */
  readonly phases: ReadonlyArray<{ label: string; done: boolean }>
}

/**
 * CRT warmup boot screen. Shown while the app is initializing readiness
 * signals (SoundCloud SDK, IndexedDB hydration, first preset channel).
 *
 * Aesthetic: black background, slow channel counter scrolling through
 * preset numbers, scanline overlay, amber/cyan color palette to match
 * the existing retro design.
 */
export function BootScreen({ phases }: Props) {
  const [counter, setCounter] = useState(1)

  // Channel counter ticks up slowly through preset numbers as visual
  // feedback that boot is progressing. Wraps at 21 (current max preset).
  useEffect(() => {
    const id = setInterval(() => {
      setCounter((c) => (c >= 21 ? 1 : c + 1))
    }, 90)
    return () => clearInterval(id)
  }, [])

  const allDone = phases.every((p) => p.done)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        fontFamily: "'VT323', 'Courier New', monospace",
        color: '#39ff14',
        opacity: allDone ? 0 : 1,
        transition: 'opacity 600ms ease-out',
        pointerEvents: allDone ? 'none' : 'auto',
      }}
      aria-hidden={allDone}
    >
      {/* Scanline overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.0) 0px, rgba(0,0,0,0.0) 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 4px)',
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
        }}
      />

      {/* Channel counter — large, dominant */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: '0.875rem',
            letterSpacing: '0.4em',
            color: 'rgba(255,170,0,0.8)',
          }}
        >
          TUNING IN
        </div>
        <div
          style={{
            fontSize: '6rem',
            lineHeight: 1,
            letterSpacing: '0.05em',
            textShadow: '0 0 12px rgba(57,255,20,0.6)',
          }}
        >
          CH{String(counter).padStart(2, '0')}
        </div>
      </div>

      {/* Phase indicator list */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          fontSize: '1.25rem',
          letterSpacing: '0.15em',
          color: 'rgba(255,255,255,0.6)',
          minWidth: 320,
        }}
      >
        {phases.map((p) => (
          <div
            key={p.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <span>{p.label}</span>
            <span
              style={{
                color: p.done ? '#39ff14' : 'rgba(255,170,0,0.6)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {p.done ? 'OK' : '…'}
            </span>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          fontSize: '0.875rem',
          letterSpacing: '0.3em',
          color: 'rgba(255,255,255,0.3)',
        }}
      >
        KRANZ-TV · STAND BY
      </div>
    </div>
  )
}
