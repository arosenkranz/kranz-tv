import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'

export const Route = createFileRoute('/')({ component: SplashScreen })

const FIRST_CHANNEL_ID = CHANNEL_PRESETS[0]?.id ?? 'nature'

export function SplashScreen() {
  const navigate = useNavigate()

  const handleTurnOn = (): void => {
    void navigate({ to: '/channel/$channelId', params: { channelId: FIRST_CHANNEL_ID } })
  }

  const handleChannelSelect = (channelId: string): void => {
    void navigate({ to: '/channel/$channelId', params: { channelId } })
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black">
      {/* CRT scanline overlay */}
      <div className="crt-overlay" aria-hidden="true" />

      {/* Static noise vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.85) 100%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center gap-8 px-4 text-center">
        {/* Channel bug */}
        <div
          className="mb-2 font-mono text-xs tracking-[0.4em] uppercase"
          style={{ color: 'rgba(255,165,0,0.6)' }}
        >
          CH 00 — SIGNAL FOUND
        </div>

        {/* Main title */}
        <h1
          className="glow-text font-mono text-8xl font-normal tracking-widest sm:text-9xl"
          style={{ color: '#39ff14', fontFamily: "'VT323', 'Courier New', monospace" }}
        >
          KRANZTV
        </h1>

        {/* Tagline */}
        <p
          className="font-mono text-lg tracking-wider sm:text-xl"
          style={{ color: 'rgba(255,165,0,0.9)', fontFamily: "'VT323', 'Courier New', monospace" }}
        >
          Live Cable TV from YouTube Playlists
        </p>

        {/* Channel count */}
        <div
          className="rounded border px-4 py-2 font-mono text-base tracking-widest"
          style={{
            color: '#39ff14',
            borderColor: 'rgba(57,255,20,0.4)',
            background: 'rgba(57,255,20,0.05)',
            fontFamily: "'VT323', 'Courier New', monospace",
          }}
        >
          &#9632; {CHANNEL_PRESETS.length} CHANNELS AVAILABLE
        </div>

        {/* CTA button */}
        <button
          onClick={handleTurnOn}
          className="mt-4 cursor-pointer rounded border-2 px-10 py-4 font-mono text-xl tracking-[0.3em] uppercase transition-all duration-150 active:scale-95"
          style={{
            color: '#000',
            backgroundColor: '#39ff14',
            borderColor: '#39ff14',
            fontFamily: "'VT323', 'Courier New', monospace",
            boxShadow: '0 0 20px rgba(57,255,20,0.5), 0 0 40px rgba(57,255,20,0.2)',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.backgroundColor = 'transparent'
            el.style.color = '#39ff14'
            el.style.boxShadow = '0 0 30px rgba(57,255,20,0.8), 0 0 60px rgba(57,255,20,0.3)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.backgroundColor = '#39ff14'
            el.style.color = '#000'
            el.style.boxShadow = '0 0 20px rgba(57,255,20,0.5), 0 0 40px rgba(57,255,20,0.2)'
          }}
        >
          TURN ON TV
        </button>

        {/* Channel list */}
        <div
          className="mt-2 w-full max-w-xl rounded border px-4 py-3"
          style={{
            borderColor: 'rgba(57,255,20,0.15)',
            backgroundColor: 'rgba(57,255,20,0.03)',
          }}
        >
          <div
            className="mb-2 font-mono text-xs tracking-[0.3em] uppercase text-center"
            style={{ color: 'rgba(255,165,0,0.5)', fontFamily: "'VT323', 'Courier New', monospace" }}
          >
            — NOW BROADCASTING —
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {CHANNEL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleChannelSelect(preset.id)}
                className="flex items-center gap-2 rounded px-2 py-1 text-left transition-colors"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(57,255,20,0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <span
                  className="font-mono text-xs tracking-widest shrink-0"
                  style={{ color: 'rgba(57,255,20,0.5)', fontFamily: "'VT323', 'Courier New', monospace", minWidth: '36px' }}
                >
                  CH{String(preset.number).padStart(2, '0')}
                </span>
                <span
                  className="font-mono text-sm tracking-wider truncate"
                  style={{ color: 'rgba(255,255,255,0.65)', fontFamily: "'VT323', 'Courier New', monospace" }}
                >
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer decoration */}
        <div
          className="mt-4 font-mono text-xs tracking-widest"
          style={{
            color: 'rgba(255,255,255,0.2)',
            fontFamily: "'VT323', 'Courier New', monospace",
          }}
        >
          &#9473;&#9473;&#9473; NO SUBSCRIPTION REQUIRED &#9473;&#9473;&#9473;
        </div>
      </div>
    </div>
  )
}
