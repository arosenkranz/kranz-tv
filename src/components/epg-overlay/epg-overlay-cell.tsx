import type { EpgEntry } from '~/lib/scheduling/types'
import { computeCellLayout } from '~/lib/epg/layout'
import { getThumbnailUrl } from '~/lib/video-utils'

export interface EpgOverlayCellProps {
  entry: EpgEntry
  isCursorRow: boolean
  windowStart: Date
  windowEnd: Date
  isExpanded: boolean
  onExpand: (cellId: string) => void
  onNavigate: () => void
}

export function EpgOverlayCell({
  entry,
  isCursorRow,
  windowStart,
  windowEnd,
  isExpanded,
  onExpand,
  onNavigate,
}: EpgOverlayCellProps) {
  const layout = computeCellLayout(entry, windowStart, windowEnd)
  if (layout === null) return null

  const { leftPct, widthPct } = layout
  const isPlaying = entry.isCurrentlyPlaying
  const cellId = `${entry.channelId}-${entry.startTime.getTime()}`

  const handleClick = (): void => {
    if (isExpanded) {
      onNavigate()
    } else {
      onExpand(cellId)
    }
  }

  const borderClass = isExpanded
    ? 'border border-amber-400'
    : isCursorRow
      ? 'border border-green-400'
      : isPlaying
        ? 'border border-green-400'
        : 'border border-zinc-600'

  const bgClass = isExpanded
    ? 'bg-amber-900/20 hover:bg-amber-900/30'
    : isCursorRow
      ? 'bg-green-900/30 hover:bg-green-900/50'
      : isPlaying
        ? 'bg-green-900/40 hover:bg-green-900/50'
        : 'bg-zinc-800/90 hover:bg-zinc-700'

  return (
    <button
      type="button"
      className={`absolute top-0 bottom-0 px-2 py-1 text-left overflow-hidden cursor-pointer transition-all duration-200 ${borderClass} ${bgClass}`}
      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      onClick={handleClick}
      title={isExpanded ? `Navigate to ${entry.label}` : entry.label}
    >
      {isExpanded ? (
        <span className="flex items-start gap-2">
          <img
            src={getThumbnailUrl(entry.video)}
            alt=""
            referrerPolicy="no-referrer"
            className="shrink-0 rounded object-cover"
            style={{ width: 64, height: 48 }}
          />
          <span
            className={`text-sm font-mono leading-tight whitespace-normal ${isPlaying ? 'glow-text text-zinc-100' : 'text-zinc-100'}`}
          >
            {entry.label}
          </span>
        </span>
      ) : (
        <span
          className={`block text-sm font-mono leading-tight truncate ${isPlaying ? 'glow-text text-zinc-100' : 'text-zinc-100'}`}
        >
          {entry.label}
        </span>
      )}
    </button>
  )
}
