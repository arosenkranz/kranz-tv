import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
} from '@tanstack/react-router'
import { LayoutGrid, Tv } from 'lucide-react'
import { ImportModal } from '~/components/import-wizard/import-modal'
import { VolumeControl } from '~/components/volume-control'
import { EpgOverlay } from '~/components/epg-overlay/epg-overlay'
import { InfoPanel } from '~/components/info-panel/info-panel'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import { buildChannel, YouTubeQuotaError } from '~/lib/channels/youtube-api'
import { useQuotaRecovery } from '~/hooks/use-quota-recovery'
import { isQuotaTimestampStale } from '~/lib/channels/quota-recovery'
import {
  loadCustomChannels,
  saveCustomChannels,
} from '~/lib/storage/local-channels'
import {
  loadCachedChannel,
  saveCachedChannel,
  clearPresetChannelCache,
} from '~/lib/storage/preset-channel-cache'
import { channelToPreset } from '~/lib/import/schema'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import { trackGuideToggle, trackImportStarted } from '~/lib/datadog/rum'
import { useFullscreen } from '~/hooks/use-fullscreen'
import { useLocalStorage } from '~/hooks/use-local-storage'
import { useIsMobile } from '~/hooks/use-is-mobile'
import { useIsDesktop } from '~/hooks/use-is-desktop'
import {
  nextOverlayMode,
  overlayClassName,
} from '~/lib/overlays'
import type { OverlayMode } from '~/lib/overlays'
import type { ChannelPreset } from '~/lib/channels/types'
import type { Channel } from '~/lib/scheduling/types'

export type ViewMode = 'normal' | 'fullscreen' | 'theater'

export interface TvLayoutContextValue {
  guideVisible: boolean
  toggleGuide: () => void
  importVisible: boolean
  toggleImport: () => void
  currentChannelId: string | null
  setCurrentChannelId: (id: string) => void
  loadedChannels: Map<string, Channel>
  registerChannel: (channel: Channel) => void
  customChannels: readonly Channel[]
  addCustomChannel: (channel: Channel) => void
  isFullscreen: boolean
  toggleFullscreen: () => void
  isTheater: boolean
  toggleTheater: () => void
  viewMode: ViewMode
  overlayMode: OverlayMode
  cycleOverlay: () => void
  isMuted: boolean
  toggleMute: () => void
  volume: number
  setVolume: (v: number) => void
  isMobile: boolean
  isQuotaExhausted: boolean
  setQuotaExhausted: () => void
  clearQuotaExhausted: () => void
}

export const TvLayoutContext = createContext<TvLayoutContextValue>({
  guideVisible: true,
  toggleGuide: () => {},
  importVisible: false,
  toggleImport: () => {},
  currentChannelId: null,
  setCurrentChannelId: () => {},
  loadedChannels: new Map(),
  registerChannel: () => {},
  customChannels: [],
  addCustomChannel: () => {},
  isFullscreen: false,
  toggleFullscreen: () => {},
  isTheater: false,
  toggleTheater: () => {},
  viewMode: 'normal',
  overlayMode: 'crt',
  cycleOverlay: () => {},
  isMuted: false,
  toggleMute: () => {},
  volume: 80,
  setVolume: () => {},
  isMobile: false,
  isQuotaExhausted: false,
  setQuotaExhausted: () => {},
  clearQuotaExhausted: () => {},
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
  const [isMuted, setIsMuted] = useLocalStorage<boolean>('kranz-tv:is-muted', false)
  const [volume, setVolume] = useLocalStorage<number>('kranz-tv:volume', 80)
  // Dev-only: ?quota_test=1 in the URL forces the quota-exhausted state so the UI can be previewed
  const devForceQuota =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('quota_test') === '1'

  const QUOTA_KEY = 'kranz-tv:quota-exhausted'

  // Read the stored timestamp and auto-clear if it predates the last midnight PT reset
  const persistedQuota = (() => {
    if (typeof window === 'undefined') return false
    const raw = localStorage.getItem(QUOTA_KEY)
    if (raw === null) return false
    const ts = Number(raw)
    // Legacy flag stored as '1' (not a timestamp) — treat as stale and clear
    if (!Number.isFinite(ts) || ts <= 1 || isQuotaTimestampStale(ts)) {
      try { localStorage.removeItem(QUOTA_KEY) } catch { /* ignore */ }
      return false
    }
    return true
  })()

  // Dev param also writes to localStorage so the splash screen picks it up immediately
  if (devForceQuota && typeof window !== 'undefined') {
    try { localStorage.setItem(QUOTA_KEY, String(Date.now())) } catch { /* ignore */ }
  }

  const [isQuotaExhausted, setIsQuotaExhausted] = useState(devForceQuota || persistedQuota)

  const setQuotaExhausted = useCallback((): void => {
    setIsQuotaExhausted(true)
    try { localStorage.setItem(QUOTA_KEY, String(Date.now())) } catch { /* ignore */ }
  }, [])

  const clearQuotaExhausted = useCallback((): void => {
    setIsQuotaExhausted(false)
    try { localStorage.removeItem(QUOTA_KEY) } catch { /* ignore */ }
  }, [])

  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined
  useQuotaRecovery(isQuotaExhausted, clearQuotaExhausted, apiKey)

  const { isFullscreen, toggleFullscreen } = useFullscreen()
  const [isTheater, setIsTheater] = useState(false)
  const toggleTheater = useCallback((): void => {
    setIsTheater((prev) => !prev)
  }, [])
  const [overlayMode, setOverlayMode] = useLocalStorage<OverlayMode>(
    'kranz-tv:overlay-mode',
    'crt',
  )
  const isMobile = useIsMobile()
  const isDesktop = useIsDesktop()

  const viewMode: ViewMode = isTheater ? 'theater' : isFullscreen ? 'fullscreen' : 'normal'

  // null on server / first render — set real time after hydration to avoid mismatch
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Hydrate custom channels and cached preset channels from localStorage on mount
  useEffect(() => {
    const stored = loadCustomChannels()
    setCustomChannels(stored)

    setLoadedChannels((prev) => {
      const next = new Map(prev)

      // Pre-populate preset channels from TTL cache so Fix 1 finds data immediately
      for (const preset of CHANNEL_PRESETS) {
        if (!next.has(preset.id)) {
          const cached = loadCachedChannel(preset.id)
          if (cached !== null) next.set(preset.id, cached)
        }
      }

      // Merge custom channels
      for (const ch of stored) {
        if (!next.has(ch.id)) next.set(ch.id, ch)
      }

      return next
    })
  }, [])

  // Eagerly fetch all preset channels so the guide populates without needing to visit each one.
  // Sequential to allow early exit on quota exhaustion without firing doomed API calls.
  useEffect(() => {
    if (!apiKey || apiKey.trim() === '') return
    if (isQuotaExhausted) return

    let cancelled = false

    const fetchAll = async (): Promise<void> => {
      for (const preset of CHANNEL_PRESETS) {
        if (cancelled) break

        // Skip the network call if this channel is already in the localStorage cache
        const lsCached = loadCachedChannel(preset.id)
        if (lsCached !== null) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!cancelled) {
            setLoadedChannels((prev) => {
              if (prev.has(preset.id)) return prev
              const next = new Map(prev)
              next.set(preset.id, lsCached)
              return next
            })
          }
          continue
        }

        try {
          const channel = await buildChannel(preset, apiKey)
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!cancelled) {
            saveCachedChannel(channel)
            setLoadedChannels((prev) => {
              if (prev.has(channel.id)) return prev
              const next = new Map(prev)
              next.set(channel.id, channel)
              return next
            })
          }
        } catch (err) {
          if (err instanceof YouTubeQuotaError) {
            clearPresetChannelCache()
            setQuotaExhausted()
            break
          }
          // Non-fatal — channel stays as "Loading..." in the guide
        }
      }
    }

    void fetchAll()

    return () => {
      cancelled = true
    }
  }, [apiKey, isQuotaExhausted, setQuotaExhausted])

  const toggleGuide = useCallback((): void => {
    setGuideVisible((prev) => { trackGuideToggle(!prev); return !prev })
  }, [])

  const toggleImport = useCallback((): void => {
    setImportVisible((prev) => { if (!prev) trackImportStarted(); return !prev })
  }, [])

  const toggleMute = useCallback((): void => {
    setIsMuted(!isMuted)
  }, [isMuted, setIsMuted])

  const registerChannel = useCallback((channel: Channel): void => {
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
    ...CHANNEL_PRESETS,
    ...customPresets,
  ]

  const currentPreset = currentChannelId
    ? allPresets.find((p) => p.id === currentChannelId)
    : undefined

  const currentChannel = currentChannelId
    ? loadedChannels.get(currentChannelId)
    : undefined

  // Derive the current position for the info panel. now ticks every 30s which is
  // fine for display — ChannelView has its own 1s tick for the player.
  const currentPosition = useMemo(
    () => (currentChannel != null && now != null ? getSchedulePosition(currentChannel, now) : null),
    [currentChannel, now],
  )

  const toolbarChannelText = currentPreset
    ? `— CH ${String(currentPreset.number).padStart(2, '0')} ${currentPreset.name.toUpperCase()}`
    : '— SELECT A CHANNEL'

  const overlayClass = overlayClassName(overlayMode)
  const isFullWidthLayout = isTheater || isFullscreen || !isDesktop

  return (
    <TvLayoutContext.Provider
      value={{
        guideVisible,
        toggleGuide,
        importVisible,
        toggleImport,
        currentChannelId,
        setCurrentChannelId,
        loadedChannels,
        registerChannel,
        customChannels,
        addCustomChannel,
        isFullscreen,
        toggleFullscreen,
        isTheater,
        toggleTheater,
        viewMode,
        overlayMode,
        cycleOverlay,
        isMuted,
        toggleMute,
        volume,
        setVolume,
        isMobile,
        isQuotaExhausted,
        setQuotaExhausted,
        clearQuotaExhausted,
      }}
    >
      {/* ── On mobile, ChannelView owns its own layout — just render the outlet ── */}
      {isMobile && <Outlet />}

      {!isMobile && (
      <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-black">

        {/* ── Three-panel desktop layout (1024px+, normal mode) ── */}
        {!isFullscreen && !isTheater && isDesktop && (
          <>
            {/* Top row: video (2/3) + info panel (1/3) */}
            <div className="flex flex-1 min-h-0">
              <main
                className="relative flex flex-col overflow-hidden"
                style={{ flex: '2', backgroundColor: '#050505' }}
              >
                <Outlet />
                {overlayMode !== 'none' && (
                  <div className={overlayClass} aria-hidden="true" />
                )}
              </main>

              <aside
                className="flex flex-col border-l overflow-hidden"
                style={{
                  flex: '1',
                  borderColor: 'rgba(57,255,20,0.15)',
                  backgroundColor: '#0a0a0a',
                }}
              >
                <InfoPanel
                  channel={currentChannel}
                  preset={currentPreset}
                  position={currentPosition}
                  allPresets={allPresets}
                  loadedChannels={loadedChannels}
                  currentChannelId={currentChannelId ?? ''}
                  onChannelSelect={handleChannelSelect}
                />
              </aside>
            </div>

            {/* Bottom row: inline EPG guide (toggleable via G) */}
            {guideVisible && now !== null && (
              <div
                className="shrink-0 border-t"
                style={{
                  height: '35vh',
                  borderColor: 'rgba(255,165,0,0.2)',
                }}
              >
                <EpgOverlay
                  visible={true}
                  channels={allPresets}
                  loadedChannels={loadedChannels}
                  currentChannelId={currentChannelId ?? ''}
                  onChannelSelect={handleChannelSelect}
                  onClose={toggleGuide}
                  now={now}
                  mode="inline"
                />
              </div>
            )}
          </>
        )}

        {/* ── Tablet / fullscreen: full-width video ── */}
        {isFullWidthLayout && (
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
            {(isFullscreen || isTheater) && (
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

        {/* Technical Difficulties banner — shown when YouTube quota is exhausted */}
        {isQuotaExhausted && !isFullscreen && !isTheater && (
          <div
            className="shrink-0 px-4 py-2 font-mono text-sm tracking-widest text-center animate-pulse"
            style={{
              backgroundColor: 'rgba(255,165,0,0.08)',
              borderTop: '1px solid rgba(255,165,0,0.3)',
              color: '#ffa500',
              fontFamily: "'VT323', 'Courier New', monospace",
            }}
            role="alert"
          >
            ▋ TECHNICAL DIFFICULTIES — PLEASE STAND BY — SHOWING SAMPLE PROGRAMMING
          </div>
        )}

        {/* Bottom toolbar — hidden in fullscreen */}
        {!isFullscreen && !isTheater && (
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
                onClick={() => setIsTheater(false)}
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
              <VolumeControl
                volume={volume}
                isMuted={isMuted}
                onVolumeChange={setVolume}
                onToggleMute={toggleMute}
              />
              <button
                type="button"
                onClick={toggleTheater}
                title="Theater mode [T]"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  color: 'rgba(255,255,255,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="Toggle theater mode"
              >
                <Tv size={14} />
              </button>
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
                <span>[↑↓] CH</span>
                <span>[M] MUTE</span>
                <span>[.,] VOL</span>
                <span>[N] INFO</span>
                <span>[I] IMPORT</span>
                <span>[F] FULL</span>
                <span>[T] THEATER</span>
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

      {/* Full-screen EPG overlay — theater/tablet modes only (desktop normal uses inline guide) */}
      {now !== null &&
        !isMobile &&
        !isFullscreen &&
        (isTheater || !isDesktop) && (
            <EpgOverlay
              visible={guideVisible}
              channels={allPresets}
              loadedChannels={loadedChannels}
              currentChannelId={currentChannelId ?? ''}
              onChannelSelect={handleChannelSelect}
              onClose={toggleGuide}
              now={now}
              mode="overlay"
            />
          )}
    </TvLayoutContext.Provider>
  )
}

