import type { EpgEntry } from '~/lib/scheduling/types'

export interface GuideCellProps {
  entry: EpgEntry
  isSelected: boolean
  onClick: () => void
  windowStart: Date
  windowEnd: Date
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function computeLayout(
  entry: EpgEntry,
  windowStart: Date,
  windowEnd: Date,
): { leftPct: number; widthPct: number } | null {
  const startMs = windowStart.getTime()
  const endMs = windowEnd.getTime()
  const windowDuration = endMs - startMs

  if (windowDuration <= 0) return null

  const entryStart = entry.startTime.getTime()
  const entryEnd = entry.endTime.getTime()

  // Entry is entirely outside the window
  if (entryEnd <= startMs || entryStart >= endMs) return null

  const visibleStart = clamp(entryStart, startMs, endMs)
  const visibleEnd = clamp(entryEnd, startMs, endMs)

  const leftPct = ((visibleStart - startMs) / windowDuration) * 100
  const widthPct = ((visibleEnd - visibleStart) / windowDuration) * 100

  return { leftPct, widthPct }
}

export function GuideCell({
  entry,
  isSelected,
  onClick,
  windowStart,
  windowEnd,
}: GuideCellProps) {
  const layout = computeLayout(entry, windowStart, windowEnd)
  if (layout === null) return null

  const { leftPct, widthPct } = layout

  const borderClass = isSelected
    ? 'border border-amber-400'
    : entry.isCurrentlyPlaying
      ? 'border border-green-500'
      : 'border border-zinc-700'

  const bgClass = entry.isCurrentlyPlaying
    ? isSelected
      ? 'bg-amber-900/80'
      : 'bg-green-900/60'
    : 'bg-zinc-800 hover:bg-zinc-700'

  return (
    <button
      type="button"
      className={`absolute top-0 bottom-0 px-2 py-1 text-left overflow-hidden cursor-pointer transition-colors ${borderClass} ${bgClass}`}
      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      onClick={onClick}
      title={entry.video.title}
    >
      <span className="block text-xs text-zinc-100 font-mono truncate leading-tight">
        {entry.video.title}
      </span>
    </button>
  )
}
