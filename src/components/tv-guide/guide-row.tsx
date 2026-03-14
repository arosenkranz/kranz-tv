import { useRef, useEffect } from 'react'
import type { EpgEntry } from '~/lib/scheduling/types'
import type { ChannelPreset } from '~/lib/channels/types'
import { GuideCell } from './guide-cell'

export interface GuideRowProps {
  channel: ChannelPreset
  entries: EpgEntry[]
  isSelected: boolean
  onChannelClick: () => void
  windowStart: Date
  windowEnd: Date
}

export function GuideRow({
  channel,
  entries,
  isSelected,
  onChannelClick,
  windowStart,
  windowEnd,
}: GuideRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected])

  const labelBorderClass = isSelected
    ? 'border-r border-amber-400 border-l-2 border-l-green-400'
    : 'border-r border-zinc-700'

  const labelBg = isSelected ? 'rgba(57,255,20,0.07)' : '#0d0d0d'

  return (
    <div ref={rowRef} className="flex h-16 border-b border-zinc-700">
      {/* Channel label — fixed width */}
      <button
        type="button"
        className={`flex-none w-40 flex flex-col justify-center px-3 cursor-pointer hover:bg-zinc-800 transition-colors overflow-hidden ${labelBorderClass}`}
        style={{ backgroundColor: labelBg }}
        onClick={onChannelClick}
        title={channel.name}
      >
        <span className="text-sm text-green-400 font-mono leading-none tracking-wider">
          CH{String(channel.number).padStart(2, '0')}
        </span>
        <span className="text-base text-white font-mono font-semibold truncate leading-tight mt-1">
          {channel.name}
        </span>
      </button>

      {/* EPG cells — relative container so cells can be absolutely positioned */}
      <div className="relative flex-1 overflow-hidden">
        {entries.map((entry) => (
          <GuideCell
            key={`${entry.channelId}-${entry.startTime.getTime()}`}
            entry={entry}
            isSelected={isSelected}
            onClick={onChannelClick}
            windowStart={windowStart}
            windowEnd={windowEnd}
          />
        ))}
      </div>
    </div>
  )
}
