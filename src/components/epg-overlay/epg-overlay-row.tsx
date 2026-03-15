import { useEffect, useRef } from 'react'
import type { EpgEntry } from '~/lib/scheduling/types'
import type { ChannelPreset } from '~/lib/channels/types'
import { EpgOverlayCell } from './epg-overlay-cell'

export interface EpgOverlayRowProps {
  channel: ChannelPreset
  entries: EpgEntry[]
  isCursorRow: boolean
  isCurrentChannel: boolean
  windowStart: Date
  windowEnd: Date
  onSelect: () => void
}

export function EpgOverlayRow({
  channel,
  entries,
  isCursorRow,
  isCurrentChannel,
  windowStart,
  windowEnd,
  onSelect,
}: EpgOverlayRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  // Auto-scroll cursor row into view
  useEffect(() => {
    if (isCursorRow && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isCursorRow])

  const labelStyle = isCursorRow
    ? 'border-r border-green-400 border-l-2 border-l-green-400'
    : isCurrentChannel
      ? 'border-r border-amber-400 border-l-2 border-l-amber-400'
      : 'border-r border-zinc-700'

  const labelBg = isCursorRow
    ? 'rgba(57,255,20,0.08)'
    : isCurrentChannel
      ? 'rgba(255,165,0,0.06)'
      : '#0d0d0d'

  const rowBg = isCursorRow ? 'rgba(57,255,20,0.04)' : 'transparent'

  return (
    <div
      ref={rowRef}
      className="flex h-14 border-b border-zinc-800"
      style={{ backgroundColor: rowBg }}
    >
      {/* Channel label — fixed 160px */}
      <button
        type="button"
        className={`flex-none flex flex-col justify-center px-3 cursor-pointer hover:bg-zinc-800 transition-colors overflow-hidden ${labelStyle}`}
        style={{ width: 160, backgroundColor: labelBg }}
        onClick={onSelect}
        title={channel.name}
      >
        <span className="text-xs text-green-400 font-mono leading-none tracking-wider">
          CH{String(channel.number).padStart(2, '0')}
        </span>
        <span className="text-sm text-white font-mono truncate leading-tight mt-0.5">
          {channel.name}
        </span>
        {isCurrentChannel && (
          <span
            className="text-xs font-mono leading-none mt-0.5"
            style={{ color: '#ffa500' }}
          >
            ▶ NOW
          </span>
        )}
      </button>

      {/* EPG cells */}
      <div className="relative flex-1 overflow-hidden">
        {entries.map((entry) => (
          <EpgOverlayCell
            key={`${entry.channelId}-${entry.startTime.getTime()}`}
            entry={entry}
            isCursorRow={isCursorRow}
            windowStart={windowStart}
            windowEnd={windowEnd}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}
