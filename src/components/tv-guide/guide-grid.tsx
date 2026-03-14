import type { Channel } from '~/lib/scheduling/types'
import type { ChannelPreset } from '~/lib/channels/types'
import { buildEpgEntries } from '~/lib/scheduling/epg-builder'
import { TimeHeader } from './time-header'
import { GuideRow } from './guide-row'

export interface GuideGridProps {
  channels: ChannelPreset[]
  loadedChannels: Map<string, Channel>
  currentChannelId: string
  onChannelSelect: (channelId: string) => void
  now: Date
}

const WINDOW_BEFORE_MS = 30 * 60 * 1000
const WINDOW_AFTER_MS = 90 * 60 * 1000

export function GuideGrid({
  channels,
  loadedChannels,
  currentChannelId,
  onChannelSelect,
}: GuideGridProps) {
  // Always use the real current time — the `now` prop just triggers re-renders
  const now = new Date()
  const nowMs = now.getTime()
  const windowStart = new Date(nowMs - WINDOW_BEFORE_MS)
  const windowEnd = new Date(nowMs + WINDOW_AFTER_MS)

  return (
    <div className="flex flex-col bg-zinc-900 border border-zinc-700 rounded overflow-hidden">
      <TimeHeader
        windowStart={windowStart}
        windowEnd={windowEnd}
        nowMs={nowMs}
      />

      <div className="overflow-y-auto flex-1">
        {channels.map((preset) => {
          const loaded = loadedChannels.get(preset.id)

          if (loaded === undefined) {
            return (
              <PlaceholderRow
                key={preset.id}
                channel={preset}
                isSelected={preset.id === currentChannelId}
                onChannelClick={() => onChannelSelect(preset.id)}
              />
            )
          }

          const entries = buildEpgEntries(loaded, windowStart, windowEnd, now)

          return (
            <GuideRow
              key={preset.id}
              channel={preset}
              entries={entries as Parameters<typeof GuideRow>[0]['entries']}
              isSelected={preset.id === currentChannelId}
              onChannelClick={() => onChannelSelect(preset.id)}
              windowStart={windowStart}
              windowEnd={windowEnd}
            />
          )
        })}
      </div>
    </div>
  )
}

interface PlaceholderRowProps {
  channel: ChannelPreset
  isSelected: boolean
  onChannelClick: () => void
}

function PlaceholderRow({
  channel,
  isSelected,
  onChannelClick,
}: PlaceholderRowProps) {
  const labelBorderClass = isSelected
    ? 'border-r border-amber-400'
    : 'border-r border-zinc-700'

  return (
    <div className="flex h-16 border-b border-zinc-800">
      <button
        type="button"
        className={`flex-none w-28 flex flex-col justify-center px-3 bg-zinc-900 cursor-pointer hover:bg-zinc-800 transition-colors overflow-hidden ${labelBorderClass}`}
        onClick={onChannelClick}
        title={channel.name}
      >
        <span className="text-sm text-zinc-400 font-mono leading-none tracking-wider">
          CH{String(channel.number).padStart(2, '0')}
        </span>
        <span className="text-base text-zinc-100 font-mono truncate leading-tight mt-1">
          {channel.name}
        </span>
      </button>

      <div className="flex-1 flex items-center px-3">
        <span className="text-sm text-zinc-500 font-mono animate-pulse">
          Loading...
        </span>
      </div>
    </div>
  )
}
