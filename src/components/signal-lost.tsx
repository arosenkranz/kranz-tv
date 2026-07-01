import { MONO_FONT } from '~/lib/theme'

interface SignalLostProps {
  channelNumber: number
  channelName: string
  onRetry: () => void
  retrying: boolean
}

/**
 * Terminal failure screen for a music channel whose playlist load failed
 * (e.g. cold Cloudflare preview: missing SC secrets or blown token cap).
 * Rendered instead of the indefinite TuningOverlay. Does NOT read live SC
 * widget status — this is a terminal state, not a tuning state.
 */
export function SignalLost({
  channelNumber,
  channelName,
  onRetry,
  retrying,
}: SignalLostProps) {
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#050505' }}
    >
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div
          className="font-mono text-3xl tracking-widest"
          style={{ color: 'rgba(255,77,77,0.85)', fontFamily: MONO_FONT }}
        >
          SIGNAL LOST
        </div>
        <div
          className="font-mono text-base tracking-wider"
          style={{ color: 'rgba(255,255,255,0.35)', fontFamily: MONO_FONT }}
        >
          CH {channelNumber} — {channelName.toUpperCase()} · COULD NOT TUNE
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-3 rounded border px-5 py-2 font-mono text-base tracking-widest"
          style={{
            color: retrying ? 'rgba(57,255,20,0.4)' : 'rgba(57,255,20,0.9)',
            borderColor: retrying ? 'rgba(57,255,20,0.2)' : 'rgba(57,255,20,0.6)',
            fontFamily: MONO_FONT,
            cursor: retrying ? 'default' : 'pointer',
          }}
        >
          {retrying ? 'RETRYING…' : '[R] RETRY'}
        </button>
      </div>
    </div>
  )
}
