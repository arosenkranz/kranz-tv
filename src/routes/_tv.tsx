import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { GuideGrid } from '~/components/tv-guide/guide-grid'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import { buildChannel } from '~/lib/channels/youtube-api'
import type { ChannelPreset } from '~/lib/channels/types'
import type { Channel } from '~/lib/scheduling/types'

export interface TvLayoutContextValue {
  guideVisible: boolean
  toggleGuide: () => void
  currentChannelId: string | null
  loadedChannels: Map<string, Channel>
  registerChannel: (channel: Channel) => void
}

export const TvLayoutContext = createContext<TvLayoutContextValue>({
  guideVisible: true,
  toggleGuide: () => {},
  currentChannelId: null,
  loadedChannels: new Map(),
  registerChannel: () => {},
})

export function useTvLayout(): TvLayoutContextValue {
  return useContext(TvLayoutContext)
}

export const Route = createFileRoute('/_tv')({
  component: TvLayout,
})

export function TvLayout() {
  const navigate = useNavigate()
  const [guideVisible, setGuideVisible] = useState(true)
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null)
  const [loadedChannels, setLoadedChannels] = useState<Map<string, Channel>>(new Map())
  const [now, setNow] = useState<Date | null>(null)

  // null on server / first render — set real time after hydration to avoid mismatch
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Eagerly fetch all channels so the guide populates without needing to visit each one
  useEffect(() => {
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined
    if (!apiKey || apiKey.trim() === '') return

    let cancelled = false

    for (const preset of CHANNEL_PRESETS) {
      buildChannel(preset, apiKey)
        .then((channel) => {
          if (!cancelled) {
            setLoadedChannels((prev) => {
              if (prev.has(channel.id)) return prev
              const next = new Map(prev)
              next.set(channel.id, channel)
              return next
            })
          }
        })
        .catch(() => {
          // Non-fatal — channel stays as "Loading..." in the guide
        })
    }

    return () => { cancelled = true }
  }, [])

  const toggleGuide = useCallback((): void => {
    setGuideVisible((prev) => !prev)
  }, [])

  const registerChannel = useCallback((channel: Channel): void => {
    setCurrentChannelId(channel.id)
    setLoadedChannels((prev) => {
      if (prev.get(channel.id) === channel) return prev
      const next = new Map(prev)
      next.set(channel.id, channel)
      return next
    })
  }, [])

  const handleChannelSelect = useCallback(
    (channelId: string): void => {
      void navigate({ to: '/channel/$channelId', params: { channelId } })
    },
    [navigate],
  )

  const currentPreset = currentChannelId
    ? CHANNEL_PRESETS.find((p) => p.id === currentChannelId)
    : undefined

  const toolbarChannelText = currentPreset
    ? `— CH ${String(currentPreset.number).padStart(2, '0')} ${currentPreset.name.toUpperCase()}`
    : '— SELECT A CHANNEL'

  return (
    <TvLayoutContext.Provider
      value={{ guideVisible, toggleGuide, currentChannelId, loadedChannels, registerChannel }}
    >
      <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-black">
        {/* CRT scanline overlay */}
        <div className="crt-overlay" aria-hidden="true" />

        {/* Main TV area: video + guide */}
        <div className="flex min-h-0 flex-1">
          {/* Video player area */}
          <main
            className="relative flex flex-col"
            style={{ width: guideVisible ? '70%' : '100%', backgroundColor: '#050505', transition: 'width 0.2s ease' }}
          >
            <Outlet />
          </main>

          {/* TV guide sidebar — conditionally visible */}
          {guideVisible && (
            <aside
              className="flex flex-col overflow-hidden border-l"
              style={{
                width: '30%',
                borderColor: 'rgba(57,255,20,0.15)',
                backgroundColor: '#0a0a0a',
              }}
            >
              {/* Guide header */}
              <div
                className="shrink-0 border-b px-4 py-3"
                style={{ borderColor: 'rgba(57,255,20,0.15)' }}
              >
                <span
                  className="font-mono text-sm tracking-widest uppercase"
                  style={{ color: '#39ff14', fontFamily: "'VT323', 'Courier New', monospace" }}
                >
                  TV GUIDE
                </span>
              </div>

              {/* Guide content — rendered client-side only to avoid SSR time mismatch */}
              <div className="flex-1 overflow-y-auto px-2 py-2" id="tv-guide-content">
                {now !== null && (
                  <GuideGrid
                    channels={CHANNEL_PRESETS as ChannelPreset[]}
                    loadedChannels={loadedChannels}
                    currentChannelId={currentChannelId ?? ''}
                    onChannelSelect={handleChannelSelect}
                    now={now}
                  />
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Bottom toolbar */}
        <div
          className="shrink-0 border-t px-4 py-2"
          style={{
            borderColor: 'rgba(57,255,20,0.2)',
            backgroundColor: '#0d0d0d',
            minHeight: '3rem',
          }}
        >
          <div className="flex items-center gap-6">
            <span
              className="font-mono text-sm tracking-widest"
              style={{ color: '#39ff14', fontFamily: "'VT323', 'Courier New', monospace" }}
            >
              KRANZTV
            </span>
            <span
              id="channel-info-toolbar"
              className="font-mono text-xs tracking-wider"
              style={{
                color: 'rgba(255,165,0,0.8)',
                fontFamily: "'VT323', 'Courier New', monospace",
              }}
            >
              {toolbarChannelText}
            </span>
            <span
              className="ml-auto font-mono text-xs tracking-wider"
              style={{
                color: 'rgba(255,255,255,0.3)',
                fontFamily: "'VT323', 'Courier New', monospace",
              }}
            >
              [G] GUIDE&nbsp;&nbsp;[↑↓] CH&nbsp;&nbsp;[M] MUTE&nbsp;&nbsp;[?] HELP
            </span>
          </div>
        </div>
      </div>
    </TvLayoutContext.Provider>
  )
}
