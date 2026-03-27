import { volumeToSegments } from '~/lib/volume'

const MONO = "'VT323', 'Courier New', monospace"
const TOTAL_SEGMENTS = 10
const GREEN = '#39ff14'
const GREEN_DIM = 'rgba(57,255,20,0.15)'

export interface VolumeOsdProps {
  volume: number
  isMuted: boolean
  visible: boolean
}

export function VolumeOsd({ volume, isMuted, visible }: VolumeOsdProps) {
  const filledCount = volumeToSegments(volume, TOTAL_SEGMENTS)

  return (
    <div
      aria-live="polite"
      aria-label={isMuted ? 'Muted' : `Volume ${volume}`}
      style={{
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        zIndex: 50,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        backgroundColor: 'rgba(0,0,0,0.85)',
        border: '1px solid rgba(57,255,20,0.4)',
        borderRadius: '4px',
        padding: '8px 12px',
        fontFamily: MONO,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        minWidth: '120px',
      }}
    >
      {/* Label row */}
      <div
        style={{
          color: isMuted ? 'rgba(255,165,0,0.9)' : GREEN,
          fontSize: '1rem',
          letterSpacing: '0.15em',
        }}
      >
        {isMuted ? 'MUTED' : 'VOL'}
      </div>

      {/* Segment bar + numeric value */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ display: 'flex', gap: '2px' }}>
          {Array.from({ length: TOTAL_SEGMENTS }, (_, i) => (
            <div
              key={i}
              data-testid="volume-segment"
              style={{
                width: '8px',
                height: '12px',
                backgroundColor:
                  i < filledCount
                    ? isMuted
                      ? 'rgba(57,255,20,0.3)'
                      : GREEN
                    : GREEN_DIM,
              }}
            />
          ))}
        </div>
        <span
          style={{
            color: isMuted ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.8)',
            fontSize: '0.9rem',
            letterSpacing: '0.05em',
            minWidth: '24px',
          }}
        >
          {volume}
        </span>
      </div>
    </div>
  )
}
