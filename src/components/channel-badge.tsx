import { stringToSeed } from '~/lib/scheduling/time-utils'
import { formatChannelNumber } from '~/lib/format'
import { MONO_FONT } from '~/lib/theme'

interface ChannelBadgeProps {
  readonly channelId: string
  readonly channelNumber: number
  readonly size?: 'sm' | 'md'
}

const SIZE_MAP = {
  sm: { padding: 'px-1.5 py-0.5', text: 'text-xs' },
  md: { padding: 'px-2 py-0.5', text: 'text-sm' },
} as const

function channelHue(channelId: string): number {
  return stringToSeed(channelId) % 360
}

export function ChannelBadge({
  channelId,
  channelNumber,
  size = 'sm',
}: ChannelBadgeProps) {
  const hue = channelHue(channelId)
  const classes = SIZE_MAP[size]

  return (
    <span
      className={`${classes.padding} ${classes.text} inline-flex shrink-0 items-center justify-center rounded font-mono tracking-wider`}
      style={{
        backgroundColor: `hsl(${hue}, 50%, 20%)`,
        color: `hsl(${hue}, 80%, 70%)`,
        fontFamily: MONO_FONT,
      }}
      aria-hidden="true"
    >
      {formatChannelNumber(channelNumber)}
    </span>
  )
}
