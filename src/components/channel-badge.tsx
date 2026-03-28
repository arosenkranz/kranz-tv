import { formatChannelNumber } from '~/lib/format'
import { MONO_FONT } from '~/lib/theme'

interface ChannelBadgeProps {
  readonly channelNumber: number
  readonly size?: 'sm' | 'md'
}

const SIZE_MAP = {
  sm: { padding: 'px-1.5 py-0.5', text: 'text-xs' },
  md: { padding: 'px-2 py-0.5', text: 'text-sm' },
} as const

export function ChannelBadge({ channelNumber, size = 'sm' }: ChannelBadgeProps) {
  const classes = SIZE_MAP[size]

  return (
    <span
      className={`${classes.padding} ${classes.text} inline-flex shrink-0 items-center justify-center rounded font-mono tracking-wider`}
      style={{
        backgroundColor: 'rgba(57,255,20,0.08)',
        color: 'rgba(57,255,20,0.6)',
        fontFamily: MONO_FONT,
      }}
      aria-hidden="true"
    >
      {formatChannelNumber(channelNumber)}
    </span>
  )
}
