import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
} from '@tanstack/react-router'
import {
  MonitorPlay,
  Volume2,
  VolumeX,
  LayoutGrid,
  Monitor,
  Play,
  ExternalLink,
} from 'lucide-react'
import { GuideGrid } from '~/components/tv-guide/guide-grid'
import { ImportModal } from '~/components/import-wizard/import-modal'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import { buildChannel } from '~/lib/channels/youtube-api'
import {
  loadCustomChannels,
  saveCustomChannels,
} from '~/lib/storage/local-channels'
import { channelToPreset } from '~/lib/import/schema'
import { useFullscreen } from '~/hooks/use-fullscreen'
import { useLocalStorage } from '~/hooks/use-local-storage'
import { useIsMobile } from '~/hooks/use-is-mobile'
import {
  nextOverlayMode,
  overlayClassName

} from '~/lib/overlays'
import type {OverlayMode} from '~/lib/overlays';
import type { ChannelPreset } from '~/lib/channels/types'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'

export type ViewMode = 'normal' | 'theater' | 'fullscreen'

export interface TvLayoutContextValue {
  guideVisible: boolean
  toggleGuide: () => void
  importVisible: boolean
  toggleImport: () => void
  currentChannelId: string | null
  loadedChannels: Map<string, Channel>
  registerChannel: (channel: Channel) => void
  customChannels: readonly Channel[]
  addCustomChannel: (channel: Channel) => void
  isFullscreen: boolean
  toggleFullscreen: () => void
  viewMode: ViewMode
  toggleTheater: () => void
  overlayMode: OverlayMode
  cycleOverlay: () => void
  currentPosition: SchedulePosition | null
  setCurrentPosition: (pos: SchedulePosition | null) => void
  isMuted: boolean
  toggleMute: () => void
  isMobile: boolean
}

export const TvLayoutContext = createContext<TvLayoutContextValue>({
  guideVisible: true,
  toggleGuide: () => {},
  importVisible: false,
  toggleImport: () => {},
  currentChannelId: null,
  loadedChannels: new Map(),
  registerChannel: () => {},
  customChannels: [],
  addCustomChannel: () => {},
  isFullscreen: false,
  toggleFullscreen: () => {},
  viewMode: 'normal',
  toggleTheater: () => {},
  overlayMode: 'crt',
  cycleOverlay: () => {},
  currentPosition: null,
  setCurrentPosition: () => {},
  isMuted: false,
  toggleMute: () => {},
  isMobile: false,
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
  const [importVisible, setImportVisible] = useState(false)
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null)
  const [loadedChannels, setLoadedChannels] = useState<Map<string, Channel>>(
    new Map(),
  )
  const [customChannels, setCustomChannels] = useState<readonly Channel[]>([])
  const [now, setNow] = useState<Date | null>(null)
  const [theaterMode, setTheaterMode] = useState(false)
  const [currentPosition, setCurrentPosition] =
    useState<SchedulePosition | null>(null)
  const [isMuted, setIsMuted] = useState(false)

  const { isFullscreen, toggleFullscreen } = useFullscreen()
  const [overlayMode, setOverlayMode] = useLocalStorage<OverlayMode>(
    'kranz-tv:overlay-mode',
    'crt',
  )
  const isMobile = useIsMobile()

  // Derive viewMode from state
  const viewMode: ViewMode = isFullscreen
    ? 'fullscreen'
    : theaterMode
      ? 'theater'
      : 'normal'

  // null on server / first render — set real time after hydration to avoid mismatch
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Hydrate custom channels from localStorage on mount
  useEffect(() => {
    const stored = loadCustomChannels()
    setCustomChannels(stored)
    if (stored.length > 0) {
      setLoadedChannels((prev) => {
        const next = new Map(prev)
        for (const ch of stored) {
          if (!next.has(ch.id)) next.set(ch.id, ch)
        }
        return next
      })
    }
  }, [])

  // Eagerly fetch all preset channels so the guide populates without needing to visit each one
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

    return () => {
      cancelled = true
    }
  }, [])

  const toggleGuide = useCallback((): void => {
    setGuideVisible((prev) => !prev)
  }, [])

  const toggleImport = useCallback((): void => {
    setImportVisible((prev) => !prev)
  }, [])

  const toggleTheater = useCallback((): void => {
    setTheaterMode((prev) => !prev)
  }, [])

  const toggleMute = useCallback((): void => {
    setIsMuted((prev) => !prev)
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

  const addCustomChannel = useCallback((channel: Channel): void => {
    setCustomChannels((prev) => {
      const next = [...prev, channel]
      saveCustomChannels(next)
      return next
    })
    setLoadedChannels((prev) => {
      const next = new Map(prev)
      next.set(channel.id, channel)
      return next
    })
  }, [])

  const cycleOverlay = useCallback((): void => {
    setOverlayMode((prev) => nextOverlayMode(prev))
  }, [setOverlayMode])

  const handleChannelSelect = useCallback(
    (channelId: string): void => {
      void navigate({ to: '/channel/$channelId', params: { channelId } })
    },
    [navigate],
  )

  const handleImportComplete = useCallback(
    (channel: Channel): void => {
      addCustomChannel(channel)
      setImportVisible(false)
      void navigate({
        to: '/channel/$channelId',
        params: { channelId: channel.id },
      })
    },
    [addCustomChannel, navigate],
  )

  // Merge preset + custom channels for the guide
  const customPresets = customChannels.map(channelToPreset)
  const allPresets: ChannelPreset[] = [
    ...(CHANNEL_PRESETS as ChannelPreset[]),
    ...customPresets,
  ]

  const currentPreset = currentChannelId
    ? allPresets.find((p) => p.id === currentChannelId)
    : undefined

  const currentChannel = currentChannelId
    ? loadedChannels.get(currentChannelId)
    : undefined

  const toolbarChannelText = currentPreset
    ? `— CH ${String(currentPreset.number).padStart(2, '0')} ${currentPreset.name.toUpperCase()}`
    : '— SELECT A CHANNEL'

  const overlayClass = overlayClassName(overlayMode)

  return (
    <TvLayoutContext.Provider
      value={{
        guideVisible,
        toggleGuide,
        importVisible,
        toggleImport,
        currentChannelId,
        loadedChannels,
        registerChannel,
        customChannels,
        addCustomChannel,
        isFullscreen,
        toggleFullscreen,
        viewMode,
        toggleTheater,
        overlayMode,
        cycleOverlay,
        currentPosition,
        setCurrentPosition,
        isMuted,
        toggleMute,
        isMobile,
      }}
    >
      {/* ── On mobile, ChannelView owns its own layout — just render the outlet ── */}
      {isMobile && <Outlet />}

      {!isMobile && (
      <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-black">
        {/* ── Theater mode: side-by-side video (2/3) + info panel (1/3) ── */}
        {viewMode === 'theater' && (
          <div className="flex flex-1 min-h-0">
            {/* Video area — 2/3 width */}
            <main
              className="relative flex flex-col overflow-hidden"
              style={{ flex: '2', backgroundColor: '#050505' }}
            >
              <Outlet />
              {overlayMode !== 'none' && (
                <div className={overlayClass} aria-hidden="true" />
              )}
            </main>

            {/* Theater info panel — 1/3 width */}
            <aside
              className="flex flex-col border-l overflow-hidden"
              style={{
                flex: '1',
                borderColor: 'rgba(57,255,20,0.15)',
                backgroundColor: '#0a0a0a',
              }}
            >
              <TheaterInfoPanel
                channel={currentChannel}
                preset={currentPreset}
                position={currentPosition}
                now={now}
                allPresets={allPresets}
                loadedChannels={loadedChannels}
                currentChannelId={currentChannelId ?? ''}
                onChannelSelect={handleChannelSelect}
              />
            </aside>
          </div>
        )}

        {/* ── Normal / fullscreen: full-width video ── */}
        {viewMode !== 'theater' && (
          <main
            className="relative flex-1 min-h-0 flex flex-col w-full overflow-hidden"
            style={{ backgroundColor: '#050505' }}
          >
            <Outlet />
            {/* Retro overlay — scoped to the player area only */}
            {overlayMode !== 'none' && (
              <div className={overlayClass} aria-hidden="true" />
            )}
            {/* Fullscreen watermark */}
            {viewMode === 'fullscreen' && (
              <div
                className="pointer-events-none absolute top-4 right-6 z-[9998] font-mono text-2xl tracking-widest"
                style={{
                  color: 'rgba(57,255,20,0.15)',
                  fontFamily: "'VT323', 'Courier New', monospace",
                }}
                aria-hidden="true"
              >
                KTV
              </div>
            )}
          </main>
        )}

        {/* TV guide — bottom panel, normal mode only, conditionally visible */}
        {viewMode === 'normal' && guideVisible && !isMobile && (
          <aside
            className="shrink-0 flex flex-col overflow-hidden border-t"
            style={{
              height: '30vh',
              borderColor: 'rgba(57,255,20,0.15)',
              backgroundColor: '#0a0a0a',
            }}
          >
            {/* Guide header */}
            <div
              className="shrink-0 border-b px-4 py-3"
              style={{ borderColor: 'rgba(57,255,20,0.2)' }}
            >
              <span
                className="flex items-center gap-2 font-mono text-sm tracking-widest uppercase"
                style={{
                  color: '#ffa500',
                  fontFamily: "'VT323', 'Courier New', monospace",
                }}
              >
                <MonitorPlay size={14} />
                TV GUIDE
              </span>
            </div>

            {/* Guide content — rendered client-side only to avoid SSR time mismatch */}
            <div className="flex-1 overflow-y-auto" id="tv-guide-content">
              {now !== null ? (
                <GuideGrid
                  channels={allPresets}
                  loadedChannels={loadedChannels}
                  currentChannelId={currentChannelId ?? ''}
                  onChannelSelect={handleChannelSelect}
                  now={now}
                />
              ) : (
                <div
                  className="font-mono text-xs tracking-wider animate-pulse px-2"
                  style={{ color: 'rgba(57,255,20,0.4)' }}
                >
                  LOADING GUIDE...
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Bottom toolbar — hidden in fullscreen */}
        {viewMode !== 'fullscreen' && !isMobile && (
          <div
            className="shrink-0 border-t px-4 py-3"
            style={{
              borderColor: 'rgba(57,255,20,0.2)',
              backgroundColor: '#0d0d0d',
              minHeight: '3.5rem',
            }}
          >
            <div className="flex items-center gap-6">
              <Link
                to="/"
                className="glow-text font-mono text-2xl tracking-widest cursor-pointer"
                style={{
                  color: '#39ff14',
                  fontFamily: "'VT323', 'Courier New', monospace",
                  textDecoration: 'none',
                }}
                title="KranzTV — go home"
              >
                KTV
              </Link>
              <span
                id="channel-info-toolbar"
                className="font-mono text-base tracking-wider"
                style={{
                  color: 'rgba(255,165,0,1.0)',
                  fontFamily: "'VT323', 'Courier New', monospace",
                }}
              >
                {toolbarChannelText}
              </span>
              <span
                className="ml-auto flex items-center gap-4 font-mono text-sm tracking-wider"
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontFamily: "'VT323', 'Courier New', monospace",
                }}
              >
                <span className="flex items-center gap-1">
                  [G] <LayoutGrid size={14} />
                </span>
                <span className="flex items-center gap-1">
                  [T] <Monitor size={14} />
                </span>
                <span>[↑↓] CH</span>
                <span>[N] INFO</span>
                <span>[I] IMPORT</span>
                <span>[F] FULL</span>
                <span>[V] OVERLAY</span>
                <span>[?] HELP</span>
              </span>
              <a
                href="https://www.youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm tracking-wider"
                style={{
                  color: 'rgba(255,255,255,0.45)',
                  fontFamily: "'VT323', 'Courier New', monospace",
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  ;(e.target as HTMLElement).style.color =
                    'rgba(255,255,255,0.7)'
                }}
                onMouseLeave={(e) => {
                  ;(e.target as HTMLElement).style.color =
                    'rgba(255,255,255,0.45)'
                }}
              >
                POWERED BY YOUTUBE
              </a>
            </div>
          </div>
        )}
      </div>
      )} {/* end !isMobile */}

      {/* Import modal — rendered at layout level so it's available on any channel */}
      <ImportModal
        visible={importVisible}
        onClose={() => setImportVisible(false)}
        onImportComplete={handleImportComplete}
        customChannels={customChannels}
      />
    </TvLayoutContext.Provider>
  )
}

// ── Theater info panel ───────────────────────────────────────────────────────

interface TheaterInfoPanelProps {
  channel: Channel | undefined
  preset: ChannelPreset | undefined
  position: SchedulePosition | null
  now: Date | null
  allPresets: ChannelPreset[]
  loadedChannels: Map<string, Channel>
  currentChannelId: string
  onChannelSelect: (id: string) => void
}

function TheaterInfoPanel({
  channel,
  preset,
  position,
  now,
  allPresets,
  loadedChannels,
  currentChannelId,
  onChannelSelect,
}: TheaterInfoPanelProps) {
  const mono = { fontFamily: "'VT323', 'Courier New', monospace" }

  // Progress through the current video
  const progressPct =
    position && position.video.durationSeconds > 0
      ? Math.min(
          100,
          (position.seekSeconds / position.video.durationSeconds) * 100,
        )
      : 0

  const remainingSec = position
    ? Math.max(0, position.video.durationSeconds - position.seekSeconds)
    : 0

  const fmtTime = (s: number): string => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 border-b px-4 py-3"
        style={{ borderColor: 'rgba(57,255,20,0.15)' }}
      >
        <span
          className="flex items-center gap-2 font-mono text-sm tracking-widest uppercase"
          style={{ color: '#39ff14', ...mono }}
        >
          <Play size={14} />
          NOW PLAYING
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {position && channel ? (
          <>
            {/* Channel */}
            <div>
              <div
                className="font-mono text-sm tracking-widest"
                style={{ color: 'rgba(57,255,20,0.6)', ...mono }}
              >
                {preset
                  ? `CH ${String(preset.number).padStart(2, '0')}`
                  : channel.id}
              </div>
              <div
                className="font-mono text-2xl tracking-wider mt-0.5"
                style={{ color: '#39ff14', ...mono }}
              >
                {channel.name.toUpperCase()}
              </div>
            </div>

            {/* Now playing title */}
            <div>
              <div
                className="font-mono text-xs tracking-widest uppercase mb-1"
                style={{ color: 'rgba(255,165,0,0.6)', ...mono }}
              >
                On Air
              </div>
              <div
                className="font-mono text-xl leading-tight"
                style={{ color: '#ffa500', ...mono }}
              >
                {position.video.title}
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between mb-1">
                <span
                  className="font-mono text-xs"
                  style={{ color: 'rgba(255,255,255,0.4)', ...mono }}
                >
                  {fmtTime(position.seekSeconds)}
                </span>
                <span
                  className="font-mono text-xs"
                  style={{ color: 'rgba(255,255,255,0.4)', ...mono }}
                >
                  -{fmtTime(remainingSec)}
                </span>
              </div>
              <div
                className="h-1 w-full rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(57,255,20,0.15)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: '#39ff14',
                    transition: 'width 1s linear',
                  }}
                />
              </div>
            </div>

            {/* Links */}
            <div className="flex flex-col gap-2">
              <a
                href={`https://www.youtube.com/watch?v=${position.video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 font-mono text-sm tracking-wider underline"
                style={{ color: 'rgba(255,255,255,0.45)', ...mono }}
              >
                <ExternalLink size={14} />
                WATCH ON YOUTUBE
              </a>
              {channel.playlistId && (
                <a
                  href={`https://www.youtube.com/playlist?list=${channel.playlistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-mono text-sm tracking-wider underline"
                  style={{ color: 'rgba(255,255,255,0.45)', ...mono }}
                >
                  <ExternalLink size={14} />
                  VIEW PLAYLIST
                </a>
              )}
            </div>

            {/* Divider */}
            <div
              className="border-t"
              style={{ borderColor: 'rgba(57,255,20,0.1)' }}
            />

            {/* Mini guide */}
            <div>
              <div
                className="font-mono text-xs tracking-widest uppercase mb-2"
                style={{ color: 'rgba(255,165,0,0.6)', ...mono }}
              >
                Channels
              </div>
              <div className="flex flex-col gap-0.5">
                {allPresets.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onChannelSelect(p.id)}
                    className="flex items-center gap-2 rounded px-2 py-1 text-left transition-colors w-full"
                    style={{
                      backgroundColor:
                        p.id === currentChannelId
                          ? 'rgba(57,255,20,0.1)'
                          : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (p.id !== currentChannelId)
                        e.currentTarget.style.backgroundColor =
                          'rgba(57,255,20,0.06)'
                    }}
                    onMouseLeave={(e) => {
                      if (p.id !== currentChannelId)
                        e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <span
                      className="font-mono text-sm shrink-0"
                      style={{
                        color:
                          p.id === currentChannelId
                            ? '#39ff14'
                            : 'rgba(57,255,20,0.45)',
                        minWidth: '40px',
                        ...mono,
                      }}
                    >
                      CH{String(p.number).padStart(2, '0')}
                    </span>
                    <span
                      className="font-mono text-sm truncate"
                      style={{
                        color:
                          p.id === currentChannelId
                            ? 'rgba(255,255,255,0.9)'
                            : 'rgba(255,255,255,0.5)',
                        ...mono,
                      }}
                    >
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div
            className="font-mono text-base tracking-wider animate-pulse"
            style={{ color: 'rgba(57,255,20,0.4)', ...mono }}
          >
            SELECT A CHANNEL
          </div>
        )}
      </div>
    </div>
  )
}
