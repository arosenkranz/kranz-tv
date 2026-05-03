import type { ChannelPreset } from '~/lib/channels/types'
import type { Channel, Video } from '~/lib/scheduling/types'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import { ChannelBadge } from '~/components/channel-badge'
import { getThumbnailUrl } from '~/lib/video-utils'
import { MONO_FONT } from '~/lib/theme'

interface MobileGuideRowProps {
  preset: ChannelPreset
  loadedChannel: Channel | undefined
  isActive: boolean
  onSelect: (id: string) => void
}

export function MobileGuideRow({
  preset,
  loadedChannel,
  isActive,
  onSelect,
}: MobileGuideRowProps) {
  const position = loadedChannel
    ? getSchedulePosition(loadedChannel, new Date())
    : null

  return (
    <button
      type="button"
      onClick={() => onSelect(preset.id)}
      className={`flex w-full items-center gap-3 px-4 text-left ${isActive ? 'py-3' : ''}`}
      style={{
        minHeight: isActive ? 80 : 56,
        backgroundColor: isActive ? 'rgba(57,255,20,0.08)' : 'transparent',
        borderLeft: isActive ? '3px solid #39ff14' : '3px solid transparent',
        boxShadow: isActive ? 'inset 0 0 12px rgba(57,255,20,0.05)' : 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      aria-label={`Channel ${preset.number}: ${preset.name}`}
    >
      {/* Channel badge */}
      <ChannelBadge channelNumber={preset.number} />

      {/* Thumbnail */}
      {position && (
        <img
          src={getThumbnailUrl(position.item as Video)}
          alt=""
          referrerPolicy="no-referrer"
          className="shrink-0 rounded object-cover"
          style={{ width: 48, height: 36 }}
        />
      )}

      {/* Channel info */}
      <div className="min-w-0 flex-1">
        <div
          className="font-mono text-base tracking-wider"
          style={{
            color: isActive
              ? 'rgba(255,255,255,0.95)'
              : 'rgba(255,255,255,0.6)',
            fontFamily: MONO_FONT,
          }}
        >
          {preset.name}
        </div>
        {position && (
          <div
            className={`font-mono tracking-wider ${isActive ? 'text-sm' : 'truncate text-xs'}`}
            style={{ color: 'rgba(255,165,0,0.7)', fontFamily: MONO_FONT }}
          >
            {(position.item as Video).title}
          </div>
        )}
      </div>
    </button>
  )
}
