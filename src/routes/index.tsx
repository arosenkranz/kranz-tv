import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import { loadCustomChannels } from '~/lib/storage/local-channels'
import { channelToPreset } from '~/lib/import/schema'
import { overlayClassName, type OverlayMode } from '~/lib/overlays'
import type { ChannelPreset } from '~/lib/channels/types'

export const Route = createFileRoute('/')({ component: SplashScreen })

const FIRST_CHANNEL_ID = CHANNEL_PRESETS[0]?.id ?? 'nature'

function readOverlayMode(): OverlayMode {
  if (typeof window === 'undefined') return 'crt'
  try {
    const raw = window.localStorage.getItem('kranz-tv:overlay-mode')
    if (raw !== null) return JSON.parse(raw) as OverlayMode
  } catch {
    // ignore
  }
  return 'crt'
}

export function SplashScreen() {
  const navigate = useNavigate()
  const [customPresets, setCustomPresets] = useState<ChannelPreset[]>([])
  const [overlayMode] = useState<OverlayMode>(readOverlayMode)

  useEffect(() => {
    const stored = loadCustomChannels()
    setCustomPresets(stored.map(channelToPreset))
  }, [])

  const allPresets = [...CHANNEL_PRESETS, ...customPresets]

  const handleTurnOn = (): void => {
    void navigate({
      to: '/channel/$channelId',
      params: { channelId: FIRST_CHANNEL_ID },
    })
  }

  const handleChannelSelect = (channelId: string): void => {
    void navigate({ to: '/channel/$channelId', params: { channelId } })
  }

  const overlayClass = overlayClassName(overlayMode)

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black">
      {/* Retro overlay — fixed on splash since it IS the full screen */}
      {overlayMode !== 'none' && (
        <div
          className={overlayClass}
          style={{ position: 'fixed' }}
          aria-hidden="true"
        />
      )}

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
          className="mb-2 font-mono text-base tracking-[0.4em] uppercase"
          style={{ color: 'rgba(255,165,0,0.85)', fontFamily: "'VT323', 'Courier New', monospace" }}
        >
          CH 00 — SIGNAL FOUND
        </div>

        {/* Main title */}
        <h1
          className="glow-text font-mono text-8xl font-normal tracking-widest sm:text-9xl"
          style={{
            color: '#39ff14',
            fontFamily: "'VT323', 'Courier New', monospace",
          }}
        >
          KTV
        </h1>

        {/* Tagline */}
        <p
          className="font-mono text-2xl tracking-wider"
          style={{
            color: '#ffa500',
            fontFamily: "'VT323', 'Courier New', monospace",
          }}
        >
          Live Cable TV from YouTube Playlists
        </p>

        {/* Channel count */}
        <div
          className="rounded border px-4 py-2 font-mono text-xl tracking-widest"
          style={{
            color: '#39ff14',
            borderColor: 'rgba(57,255,20,0.5)',
            background: 'rgba(57,255,20,0.05)',
            fontFamily: "'VT323', 'Courier New', monospace",
          }}
        >
          &#9632; {allPresets.length} CHANNELS AVAILABLE
        </div>

        {/* CTA button */}
        <button
          onClick={handleTurnOn}
          className="mt-4 cursor-pointer rounded border-2 px-10 py-4 font-mono text-2xl tracking-[0.3em] uppercase transition-all duration-150 active:scale-95"
          style={{
            color: '#000',
            backgroundColor: '#39ff14',
            borderColor: '#39ff14',
            fontFamily: "'VT323', 'Courier New', monospace",
            boxShadow:
              '0 0 20px rgba(57,255,20,0.5), 0 0 40px rgba(57,255,20,0.2)',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.backgroundColor = 'transparent'
            el.style.color = '#39ff14'
            el.style.boxShadow =
              '0 0 30px rgba(57,255,20,0.8), 0 0 60px rgba(57,255,20,0.3)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.backgroundColor = '#39ff14'
            el.style.color = '#000'
            el.style.boxShadow =
              '0 0 20px rgba(57,255,20,0.5), 0 0 40px rgba(57,255,20,0.2)'
          }}
        >
          TURN ON TV
        </button>

        {/* Preset channels */}
        <div
          className="mt-2 w-full max-w-xl rounded border px-4 py-3"
          style={{
            borderColor: 'rgba(57,255,20,0.15)',
            backgroundColor: 'rgba(57,255,20,0.03)',
          }}
        >
          <div
            className="mb-3 font-mono text-base tracking-[0.3em] uppercase text-center"
            style={{
              color: 'rgba(255,165,0,0.8)',
              fontFamily: "'VT323', 'Courier New', monospace",
            }}
          >
            — NOW BROADCASTING —
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {CHANNEL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleChannelSelect(preset.id)}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-left transition-colors"
                style={{ background: 'transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(57,255,20,0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <span
                  className="font-mono text-base tracking-widest shrink-0"
                  style={{
                    color: 'rgba(57,255,20,0.75)',
                    fontFamily: "'VT323', 'Courier New', monospace",
                    minWidth: '44px',
                  }}
                >
                  CH{String(preset.number).padStart(2, '0')}
                </span>
                <span
                  className="font-mono text-lg tracking-wider truncate"
                  style={{
                    color: 'rgba(255,255,255,0.9)',
                    fontFamily: "'VT323', 'Courier New', monospace",
                  }}
                >
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Imported channels — shown only when custom channels exist */}
        {customPresets.length > 0 && (
          <div
            className="w-full max-w-xl rounded border px-4 py-3"
            style={{
              borderColor: 'rgba(255,165,0,0.2)',
              backgroundColor: 'rgba(255,165,0,0.03)',
            }}
          >
            <div
              className="mb-3 font-mono text-base tracking-[0.3em] uppercase text-center"
              style={{
                color: 'rgba(255,165,0,0.9)',
                fontFamily: "'VT323', 'Courier New', monospace",
              }}
            >
              — IMPORTED —
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {customPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleChannelSelect(preset.id)}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-left transition-colors"
                  style={{ background: 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      'rgba(255,165,0,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <span
                    className="font-mono text-base tracking-widest shrink-0"
                    style={{
                      color: 'rgba(255,165,0,0.8)',
                      fontFamily: "'VT323', 'Courier New', monospace",
                      minWidth: '44px',
                    }}
                  >
                    CH{String(preset.number).padStart(2, '0')}
                  </span>
                  <span
                    className="font-mono text-lg tracking-wider truncate"
                    style={{
                      color: 'rgba(255,255,255,0.9)',
                      fontFamily: "'VT323', 'Courier New', monospace",
                    }}
                  >
                    {preset.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer decoration */}
        <div
          className="mt-4 font-mono text-base tracking-widest"
          style={{
            color: 'rgba(255,255,255,0.35)',
            fontFamily: "'VT323', 'Courier New', monospace",
          }}
        >
          &#9473;&#9473;&#9473; NO SUBSCRIPTION REQUIRED &#9473;&#9473;&#9473;
        </div>
      </div>
    </div>
  )
}
