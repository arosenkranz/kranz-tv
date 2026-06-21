import { tuningPhase } from '~/lib/sources/soundcloud/tuning-state'
import type { WidgetStatus } from '~/lib/sources/soundcloud/tuning-state'
import { formatChannelNumber } from '~/lib/format'
import { MONO_FONT } from '~/lib/theme'

interface TuningOverlayProps {
  readonly channelNumber: number
  readonly channelName: string
  readonly isActiveChannel: boolean
  readonly status: WidgetStatus
}

export function TuningOverlay({
  channelNumber,
  channelName,
  isActiveChannel,
  status,
}: TuningOverlayProps) {
  const { label, showStatic } = tuningPhase({ isActiveChannel, status })
  if (!showStatic) return null

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
      style={{ zIndex: 25 }}
      data-testid="tuning-overlay"
    >
      <div
        className="static-burst absolute inset-0"
        data-testid="tuning-static"
        style={{ opacity: 0.7 }}
      />
      <div className="absolute top-4 left-4" style={{ zIndex: 26 }}>
        <span
          className="font-mono text-2xl tracking-widest"
          style={{
            color: '#39ff14',
            fontFamily: MONO_FONT,
            textShadow: '0 0 8px #39ff14, 0 0 16px rgba(57,255,20,0.4)',
          }}
        >
          {formatChannelNumber(channelNumber)}
        </span>
        <span
          className="font-mono text-sm tracking-wider ml-3"
          style={{ color: '#39ff14', fontFamily: MONO_FONT, opacity: 0.8 }}
        >
          {channelName.toUpperCase()}
        </span>
      </div>
      <div
        className="absolute inset-x-0 bottom-12 text-center font-mono text-base tracking-[0.3em]"
        style={{
          color: '#39ff14',
          fontFamily: MONO_FONT,
          textShadow: '0 0 8px rgba(57,255,20,0.5)',
        }}
      >
        {label}
      </div>
    </div>
  )
}
