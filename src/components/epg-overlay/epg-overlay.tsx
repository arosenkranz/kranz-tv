import { useState, useEffect } from 'react'
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
  mode?: 'overlay' | 'inline'
}

function computePlayingCellId(
  channels: ChannelPreset[],
  loadedChannels: Map<string, Channel>,
  currentChannelId: string,
  now: Date,
): string | null {
  const currentChannel = loadedChannels.get(currentChannelId)
  if (!currentChannel) return null

  const windowStart = new Date(now.getTime() - 30 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 120 * 60 * 1000)
  const entries = buildEpgEntries(currentChannel, windowStart, windowEnd, now)
  const playing = entries.find((e) => e.isCurrentlyPlaying)
  if (!playing) return null
  return `${playing.channelId}-${playing.startTime.getTime()}`
}

export function EpgOverlay({
  visible,
  channels,
  loadedChannels,
  currentChannelId,
  onChannelSelect,
  onClose,
  now,
  mode = 'overlay',
}: EpgOverlayProps) {
  const currentIndex = channels.findIndex((c) => c.id === currentChannelId)
  const safeCurrentIndex = currentIndex === -1 ? 0 : currentIndex

  // Time window: -30min to +120min (2.5 hours)
  const windowStart = new Date(now.getTime() - 30 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 120 * 60 * 1000)

  // Auto-expand the currently-playing cell on the active channel
  const [expandedCellId, setExpandedCellId] = useState<string | null>(() =>
    computePlayingCellId(channels, loadedChannels, currentChannelId, now),
  )

  // Re-initialize expanded cell when the active channel changes
  useEffect(() => {
    setExpandedCellId(
      computePlayingCellId(channels, loadedChannels, currentChannelId, now),
    )
  }, [currentChannelId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExpandCell = (cellId: string): void => {
    setExpandedCellId(cellId)
  }

  const handleCellNavigate = (channelId: string): void => {
    onChannelSelect(channelId)
    if (mode === 'overlay') onClose()
  }

  const { cursorIndex } = useEpgNavigation({
    isOpen: visible,
    channelCount: channels.length,
    initialIndex: safeCurrentIndex,
    onSelect: (index) => {
      const channel = channels[index]
      if (channel) onChannelSelect(channel.id)
    },
    onClose,
    captureKeys: mode === 'overlay',
  })

  if (!visible) return null

  const rowList = channels.map((channel, index) => {
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
          if (mode === 'overlay') onClose()
        }}
        expandedCellId={expandedCellId}
        onExpandCell={handleExpandCell}
        onCellNavigate={handleCellNavigate}
      />
    )
  })

  // Inline mode: render as a flow element (no fixed positioning, no backdrop)
  if (mode === 'inline') {
    return (
      <div
        className="flex flex-col h-full"
        style={{ backgroundColor: '#080808' }}
        aria-label="TV Guide"
      >
        <EpgOverlayHeader mode="inline" />
        <EpgTimeHeader windowStart={windowStart} windowEnd={windowEnd} nowMs={now.getTime()} />
        <div className="flex-1 overflow-y-auto">
          {rowList}
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      role="dialog"
      aria-modal="true"
      aria-label="TV Guide"
    >
      <EpgOverlayHeader mode="overlay" />
      <EpgTimeHeader windowStart={windowStart} windowEnd={windowEnd} nowMs={now.getTime()} />
      <div className="flex-1 overflow-y-auto">
        {rowList}
      </div>
    </div>
  )
}
