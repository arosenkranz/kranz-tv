import type { EpgEntry } from '~/lib/scheduling/types'
import { computeCellLayout } from '~/lib/epg/layout'

export interface GuideCellProps {
  entry: EpgEntry
  isSelected: boolean
  onClick: () => void
  windowStart: Date
  windowEnd: Date
}

export function GuideCell({
  entry,
  isSelected,
  onClick,
  windowStart,
  windowEnd,
}: GuideCellProps) {
  const layout = computeCellLayout(entry, windowStart, windowEnd)
  if (layout === null) return null

  const { leftPct, widthPct } = layout

  const isPlaying = entry.isCurrentlyPlaying

  const borderClass = isSelected
    ? 'border border-amber-400'
    : isPlaying
      ? 'border border-green-400'
      : 'border border-zinc-600'

  const bgClass = isPlaying
    ? isSelected
      ? 'bg-amber-900/80'
      : 'bg-green-900/40'
    : 'bg-zinc-800/90 hover:bg-zinc-700'

  return (
    <button
      type="button"
      className={`absolute top-0 bottom-0 px-2 py-1 text-left overflow-hidden cursor-pointer transition-colors ${borderClass} ${bgClass}`}
      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      onClick={onClick}
      title={entry.label}
    >
      <span
        className={`block text-sm font-mono truncate leading-tight ${isPlaying ? 'glow-text text-zinc-100' : 'text-zinc-100'}`}
      >
        {entry.label}
      </span>
    </button>
  )
}
