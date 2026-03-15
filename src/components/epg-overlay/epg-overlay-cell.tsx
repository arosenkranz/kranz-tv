import type { EpgEntry } from '~/lib/scheduling/types'
import { computeCellLayout } from '~/lib/epg/layout'

export interface EpgOverlayCellProps {
  entry: EpgEntry
  isCursorRow: boolean
  windowStart: Date
  windowEnd: Date
  onSelect: () => void
}

export function EpgOverlayCell({
  entry,
  isCursorRow,
  windowStart,
  windowEnd,
  onSelect,
}: EpgOverlayCellProps) {
  const layout = computeCellLayout(entry, windowStart, windowEnd)
  if (layout === null) return null

  const { leftPct, widthPct } = layout
  const isPlaying = entry.isCurrentlyPlaying

  const borderClass = isCursorRow
    ? 'border border-green-400'
    : isPlaying
      ? 'border border-green-400'
      : 'border border-zinc-600'

  const bgClass = isCursorRow
    ? 'bg-green-900/30 hover:bg-green-900/50'
    : isPlaying
      ? 'bg-green-900/40 hover:bg-green-900/50'
      : 'bg-zinc-800/90 hover:bg-zinc-700'

  return (
    <button
      type="button"
      className={`absolute top-0 bottom-0 px-2 py-1 text-left overflow-hidden cursor-pointer transition-colors ${borderClass} ${bgClass}`}
      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      onClick={onSelect}
      title={entry.video.title}
    >
      <span
        className={`block text-sm font-mono truncate leading-tight ${isPlaying ? 'glow-text text-zinc-100' : 'text-zinc-100'}`}
      >
        {entry.video.title}
      </span>
    </button>
  )
}
