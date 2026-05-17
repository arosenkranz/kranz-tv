import type { VisualizerPreset, VisualizerStyleMeta } from '~/lib/visualizers/types'

interface Props {
  activePreset: VisualizerPreset
  styles: readonly VisualizerStyleMeta[]
  onChange: (preset: VisualizerPreset) => void
}

export function VisualizerPicker({ activePreset, styles, onChange }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        padding: '8px 0',
      }}
    >
      {styles.map((meta) => {
        const isActive = meta.id === activePreset
        return (
          <button
            key={meta.id}
            type="button"
            onClick={() => onChange(meta.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '6px 4px',
              background: 'transparent',
              border: isActive
                ? '2px solid #39ff14'
                : '2px solid rgba(255,255,255,0.15)',
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            aria-pressed={isActive}
            aria-label={meta.displayName}
          >
            <div
              style={{
                width: '100%',
                height: 32,
                borderRadius: 2,
                background: meta.previewGradient,
              }}
            />
            <span
              style={{
                fontFamily: "'VT323', 'Courier New', monospace",
                fontSize: '0.75rem',
                letterSpacing: '0.05em',
                color: isActive ? '#39ff14' : 'rgba(255,255,255,0.7)',
                textAlign: 'center',
                textTransform: 'uppercase',
                lineHeight: 1.2,
              }}
            >
              {meta.displayName}
            </span>
          </button>
        )
      })}
    </div>
  )
}
