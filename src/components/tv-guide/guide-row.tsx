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
  const labelBorderClass = isSelected ? 'border-r border-amber-400' : 'border-r border-zinc-700'

  return (
    <div className="flex h-12 border-b border-zinc-800">
      {/* Channel label — fixed width */}
      <button
        type="button"
        className={`flex-none w-20 flex flex-col justify-center px-2 bg-zinc-900 cursor-pointer hover:bg-zinc-800 transition-colors overflow-hidden ${labelBorderClass}`}
        onClick={onChannelClick}
        title={channel.name}
      >
        <span className="text-xs text-zinc-500 font-mono leading-none">CH {channel.number}</span>
        <span className="text-xs text-zinc-200 font-mono truncate leading-tight mt-0.5">
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
