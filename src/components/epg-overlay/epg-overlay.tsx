import type { ChannelPreset } from '~/lib/channels/types'
import type { Channel } from '~/lib/scheduling/types'
import { buildEpgEntries } from '~/lib/scheduling/epg-builder'
import { useEpgNavigation } from '~/hooks/use-epg-navigation'
import { EpgOverlayHeader } from './epg-overlay-header'
import { EpgTimeHeader } from './epg-time-header'
import { EpgOverlayRow } from './epg-overlay-row'

export interface EpgOverlayProps {
  visible: boolean
  channels: ChannelPreset[]
  loadedChannels: Map<string, Channel>
  currentChannelId: string
  onChannelSelect: (channelId: string) => void
  onClose: () => void
  now: Date
}

export function EpgOverlay({
  visible,
  channels,
  loadedChannels,
  currentChannelId,
  onChannelSelect,
  onClose,
  now,
}: EpgOverlayProps) {
  const currentIndex = channels.findIndex((c) => c.id === currentChannelId)
  const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex

  // Time window: -30min to +120min (2.5 hours)
  const windowStart = new Date(now.getTime() - 30 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 120 * 60 * 1000)

  const { cursorIndex } = useEpgNavigation({
    isOpen: visible,
    channelCount: channels.length,
    initialIndex: safeCurrentIndex,
    onSelect: (index) => {
      const channel = channels[index]
      if (channel) onChannelSelect(channel.id)
    },
    onClose,
  })

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      role="dialog"
      aria-modal="true"
      aria-label="TV Guide"
    >
      <EpgOverlayHeader nowMs={now.getTime()} />
      <EpgTimeHeader windowStart={windowStart} windowEnd={windowEnd} nowMs={now.getTime()} />

      {/* Scrollable channel rows */}
      <div className="flex-1 overflow-y-auto">
        {channels.map((channel, index) => {
          const loadedChannel = loadedChannels.get(channel.id)
          const entries = loadedChannel
            ? buildEpgEntries(loadedChannel, windowStart, windowEnd, now)
            : []

          return (
            <EpgOverlayRow
              key={channel.id}
              channel={channel}
              entries={[...entries]}
              isCursorRow={index === cursorIndex}
              isCurrentChannel={channel.id === currentChannelId}
              windowStart={windowStart}
              windowEnd={windowEnd}
              onSelect={() => {
                onChannelSelect(channel.id)
                onClose()
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
