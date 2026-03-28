import { stringToSeed } from '~/lib/scheduling/time-utils'

interface ChannelBadgeProps {
  readonly emoji: string
  readonly channelId: string
  readonly size?: 'sm' | 'md'
}

const SIZE_MAP = {
  sm: { container: 'w-6 h-6 rounded', text: 'text-sm' },
  md: { container: 'w-8 h-8 rounded-md', text: 'text-base' },
} as const

function channelHue(channelId: string): number {
  return stringToSeed(channelId) % 360
}

export function ChannelBadge({
  emoji,
  channelId,
  size = 'sm',
}: ChannelBadgeProps) {
  const hue = channelHue(channelId)
  const classes = SIZE_MAP[size]

  return (
    <span
      className={`${classes.container} inline-flex shrink-0 items-center justify-center ${classes.text}`}
      style={{ backgroundColor: `hsl(${hue}, 60%, 35%)` }}
      aria-hidden="true"
    >
      {emoji}
    </span>
  )
}
