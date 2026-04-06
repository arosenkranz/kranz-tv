import type { ChannelPreset } from '~/lib/channels/types'
import { formatChannelNumber } from '~/lib/format'
import { MONO_FONT } from '~/lib/theme'

const GREEN = '#39ff14'
const ORANGE = '#ffa500'
const GREEN_DIM = 'rgba(57,255,20,0.15)'
const GREEN_BORDER = 'rgba(57,255,20,0.25)'
const BG = 'rgba(0,0,0,0.8)'

export interface SurfInfoBarProps {
  readonly channel: ChannelPreset | null
  readonly videoTitle: string
  readonly countdown: number
  readonly dwellSeconds: number
  readonly visible: boolean
  readonly isMobile: boolean
  readonly onDwellTap?: () => void
}

export function SurfInfoBar({
  channel,
  videoTitle,
  countdown,
  dwellSeconds,
  visible,
  isMobile,
  onDwellTap,
}: SurfInfoBarProps) {
  const isVisible = visible && channel !== null

  return (
    <div
      data-testid="surf-info-bar"
      style={{
        position: 'absolute',
        bottom: '1rem',
        left: '1rem',
        right: isMobile ? '1rem' : '30%',
        zIndex: 25,
        backgroundColor: BG,
        backdropFilter: 'blur(4px)',
        border: `1px solid ${GREEN_BORDER}`,
        borderRadius: '4px',
        padding: '10px 14px',
        fontFamily: MONO_FONT,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 300ms ease',
        pointerEvents: isVisible ? 'auto' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <style>{`@keyframes surf-progress { from { width: 100%; } to { width: 0%; } }`}</style>

      {/* Row 1: Channel number + name + SURF badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          data-testid="surf-channel-number"
          style={{
            color: GREEN,
            fontWeight: 'bold',
            fontSize: '1rem',
            letterSpacing: '0.1em',
          }}
        >
          {channel ? formatChannelNumber(channel.number) : ''}
        </span>
        <span
          data-testid="surf-channel-name"
          style={{
            color: GREEN,
            fontSize: '1rem',
            opacity: 0.8,
          }}
        >
          {channel?.name ?? ''}
        </span>
        <span
          data-testid="surf-badge"
          style={{
            marginLeft: 'auto',
            backgroundColor: GREEN,
            color: '#000',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            padding: '1px 6px',
            borderRadius: '2px',
            letterSpacing: '0.15em',
          }}
        >
          SURF
        </span>
      </div>

      {/* Row 2: Video title */}
      <div
        data-testid="surf-video-title"
        style={{
          color: ORANGE,
          fontSize: '0.9rem',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {videoTitle}
      </div>

      {/* Row 3: Progress bar + countdown */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            flex: 1,
            height: '3px',
            backgroundColor: GREEN_DIM,
            borderRadius: '1px',
            overflow: 'hidden',
          }}
        >
          <div
            key={channel?.id ?? 'empty'}
            data-testid="surf-progress-fill"
            style={{
              height: '100%',
              backgroundColor: GREEN,
              animation: `surf-progress ${dwellSeconds}s linear forwards`,
            }}
          />
        </div>
        {isMobile && onDwellTap ? (
          <button
            data-testid="surf-countdown"
            type="button"
            onClick={onDwellTap}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              margin: 0,
              cursor: 'pointer',
              color: GREEN,
              fontSize: '0.85rem',
              fontFamily: MONO_FONT,
              letterSpacing: '0.1em',
              whiteSpace: 'nowrap',
            }}
          >
            NEXT {countdown}s
          </button>
        ) : (
          <span
            data-testid="surf-countdown"
            style={{
              color: GREEN,
              fontSize: '0.85rem',
              letterSpacing: '0.1em',
              whiteSpace: 'nowrap',
            }}
          >
            NEXT {countdown}s
          </span>
        )}
      </div>
    </div>
  )
}
