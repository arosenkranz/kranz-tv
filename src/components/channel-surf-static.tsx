import type { ChannelPreset } from '~/lib/channels/types'

const MONO = "'VT323', 'Courier New', monospace"

function formatChannelNumber(n: number): string {
  return `CH${String(n).padStart(2, '0')}`
}

interface ChannelSurfStaticProps {
  readonly channel: ChannelPreset | null
  readonly showStatic: boolean
  readonly showOsd: boolean
}

export function ChannelSurfStatic({
  channel,
  showStatic,
  showOsd,
}: ChannelSurfStaticProps) {
  if (!showStatic && !showOsd) return null

  return (
    <>
      {showStatic && (
        <div
          className="static-burst absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ zIndex: 20 }}
          data-testid="surf-static"
        />
      )}

      {showOsd && channel !== null && (
        <div
          className={`absolute top-4 left-4 pointer-events-none ${showStatic ? '' : 'osd-fade'}`}
          style={{ zIndex: 21 }}
          data-testid="surf-osd"
        >
          <span
            className="font-mono text-2xl tracking-widest"
            style={{
              color: '#39ff14',
              fontFamily: MONO,
              textShadow: '0 0 8px #39ff14, 0 0 16px rgba(57,255,20,0.4)',
            }}
          >
            {formatChannelNumber(channel.number)}
          </span>
          <span
            className="font-mono text-sm tracking-wider ml-3"
            style={{
              color: '#39ff14',
              fontFamily: MONO,
              opacity: 0.8,
              textShadow: '0 0 6px rgba(57,255,20,0.3)',
            }}
          >
            {channel.name.toUpperCase()}
          </span>
        </div>
      )}
    </>
  )
}
