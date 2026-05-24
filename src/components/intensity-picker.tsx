import type { IntensityLevel } from '~/lib/visualizers/types'
import { INTENSITY_LEVELS } from '~/lib/visualizers/types'
import { MONO_FONT } from '~/lib/theme'

interface Props {
  activeLevel: IntensityLevel
  onChange: (level: IntensityLevel) => void
}

const LEVEL_LABELS: Record<IntensityLevel, string> = {
  chill:   'Chill',
  normal:  'Normal',
  intense: 'Intense',
  max:     'Max',
}

export function IntensityPicker({ activeLevel, onChange }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 5,
      }}
    >
      {INTENSITY_LEVELS.map((level) => {
        const isActive = level === activeLevel
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            aria-pressed={isActive}
            aria-label={LEVEL_LABELS[level]}
            style={{
              flex: 1,
              padding: '5px 4px',
              background: isActive ? 'rgba(57,255,20,0.1)' : 'transparent',
              border: isActive
                ? '1px solid #39ff14'
                : '1px solid rgba(255,255,255,0.14)',
              borderRadius: 2,
              cursor: 'pointer',
              fontFamily: MONO_FONT,
              fontSize: '0.75rem',
              letterSpacing: '0.05em',
              color: isActive ? '#39ff14' : 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase',
              transition: 'border-color 0.12s, color 0.12s',
              whiteSpace: 'nowrap',
            }}
          >
            {LEVEL_LABELS[level]}
          </button>
        )
      })}
    </div>
  )
}
