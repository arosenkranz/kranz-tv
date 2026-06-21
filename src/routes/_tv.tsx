import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { QuotaBanner } from '~/components/quota-banner'
import { VolumeControl } from '~/components/volume-control'
import { TheaterControls } from '~/components/theater-controls'
import { useIdleTimeout } from '~/hooks/use-idle-timeout'
import { EpgOverlay } from '~/components/epg-overlay/epg-overlay'
import { InfoPanel } from '~/components/info-panel/info-panel'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import {
  buildChannel,
  YouTubeQuotaError,
} from '~/lib/channels/youtube-api'
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
import {
  ScWidgetProvider,
  useScWidget,
} from '~/lib/sources/soundcloud/sc-widget-context'
import { BootScreen } from '~/components/boot-screen'
import { channelToPreset } from '~/lib/import/schema'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import { shouldApplyImmediately } from '~/lib/channels/revalidation'
import {
  trackGuideToggle,
  trackImportStarted,
  trackShareChannel,
  trackViewModeChange,
  trackOverlayChange,
  setViewerContext,
  trackMusicBackdropSelected,
} from '~/lib/datadog/rum'
import { logChannelLoadFailed } from '~/lib/datadog/logs'
import { useToast } from '~/hooks/use-toast'
import { copyToClipboard } from '~/lib/clipboard'
import { Toast } from '~/components/toast'
import { useFullscreen } from '~/hooks/use-fullscreen'
import { useLocalStorage } from '~/hooks/use-local-storage'
import { useIsMobile } from '~/hooks/use-is-mobile'
import { useIsDesktop } from '~/hooks/use-is-desktop'
import { nextOverlayMode } from '~/lib/overlays'
import { OverlayCanvas } from '~/components/overlay-canvas'
import type { OverlayMode } from '~/lib/overlays'
import { DesktopWelcome } from '~/components/desktop-welcome'
import { useOnboarding } from '~/hooks/use-onboarding'
import type { ChannelPreset } from '~/lib/channels/types'
import { useSurfMode } from '~/hooks/use-surf-mode'
import { SurfModeContext } from '~/contexts/surf-mode-context'
import type { NavigationSource } from '~/hooks/use-channel-surf'
import type { Channel } from '~/lib/scheduling/types'
import {
  resolvePreset,
  savePreset,
  resolveIntensity,
  saveIntensity,
} from '~/lib/visualizers/preset'
import { DEFAULT_INTENSITY } from '~/lib/visualizers/types'
import type { VisualizerPreset, IntensityLevel } from '~/lib/visualizers/types'

export type ViewMode = 'normal' | 'fullscreen' | 'theater'

export interface CustomChannelUpdates {
  readonly name?: string
  readonly number?: number
  readonly description?: string
}

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
  addCustomChannels: (channels: readonly Channel[]) => void
  removeCustomChannel: (id: string) => void
  updateCustomChannel: (id: string, updates: CustomChannelUpdates) => void
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
  navigationSource: NavigationSource
  setNavigationSource: (source: NavigationSource) => void
  needsDesktopOnboarding: boolean
  dismissDesktopOnboarding: () => void
  activePreset: VisualizerPreset
  setActivePreset: (preset: VisualizerPreset) => void
  activeIntensity: IntensityLevel
  setActiveIntensity: (level: IntensityLevel) => void
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
  addCustomChannels: () => {},
  removeCustomChannel: () => {},
  updateCustomChannel: () => {},
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
  navigationSource: 'direct' as NavigationSource,
  setNavigationSource: () => {},
  needsDesktopOnboarding: false,
  dismissDesktopOnboarding: () => {},
  activePreset: 'spectrum',
  setActivePreset: () => {},
  activeIntensity: DEFAULT_INTENSITY,
  setActiveIntensity: () => {},
})

export function useTvLayout(): TvLayoutContextValue {
  return useContext(TvLayoutContext)
}

export const Route = createFileRoute('/_tv')({
  component: TvLayoutWithProviders,
})

/**
 * Outer shell: mounts the ScWidgetProvider so TvLayout (inside) can call
 * useScWidget(). Required for the boot-screen readiness gate to read SC
 * widget state without violating the rules-of-hooks ordering.
 *
 * The provider receives isMuted/volume from a thin wrapper that reads the
 * same localStorage keys TvLayout uses, so the widget honours volume and
 * mute changes without TvLayout having to relay them through props.
 */
function TvLayoutWithProviders() {
  return <ProviderWiring />
}

function ProviderWiring() {
  const [isMuted] = useLocalStorage<boolean>('kranz-tv:is-muted', false)
  const [volume] = useLocalStorage<number>('kranz-tv:volume', 80)
  return (
    <ScWidgetProvider isMuted={isMuted} volume={volume}>
      <TvLayout />
    </ScWidgetProvider>
  )
}

export function TvLayout() {
  const navigate = useNavigate()
  const [guideVisible, setGuideVisible] = useState(true)
  const [importVisible, setImportVisible] = useState(false)
  const [activePreset, setActivePresetState] = useState<VisualizerPreset>('spectrum')
  const setActivePreset = useCallback((preset: VisualizerPreset) => {
    setActivePresetState(preset)
    savePreset(preset)
    trackMusicBackdropSelected(preset)
  }, [])

  const [activeIntensity, setActiveIntensityState] =
    useState<IntensityLevel>(DEFAULT_INTENSITY)
  const setActiveIntensity = useCallback((level: IntensityLevel) => {
    setActiveIntensityState(level)
    saveIntensity(level)
  }, [])
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null)
  const [loadedChannels, setLoadedChannels] = useState<Map<string, Channel>>(
    new Map(),
  )
  // Fresh channel data fetched while a channel was active and playing — held
  // here and applied on next entry into that channel (see applyStagedChannel).
  // Entries persist until the channel is re-entered (flushed) or the page
  // reloads — not auto-pruned; bounded by channel count.
  const stagedChannelsRef = useRef<Map<string, Channel>>(new Map())
  // Mirror of currentChannelId for closures (the eager-fetch effect) that must
  // read the *latest* active channel without re-running on every channel change.
  const activeChannelIdRef = useRef<string | null>(currentChannelId)
  activeChannelIdRef.current = currentChannelId
  const [customChannels, setCustomChannels] = useState<readonly Channel[]>([])
  const [hydrationDone, setHydrationDone] = useState(false)
  const { isReady: scReady } = useScWidget()
  const [now, setNow] = useState<Date | null>(null)
  const [isMuted, setIsMuted] = useLocalStorage<boolean>(
    'kranz-tv:is-muted',
    false,
  )
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
      try {
        localStorage.removeItem(QUOTA_KEY)
      } catch {
        /* ignore */
      }
      return false
    }
    return true
  })()

  // Dev param also writes to localStorage so the splash screen picks it up immediately
  if (devForceQuota && typeof window !== 'undefined') {
    try {
      localStorage.setItem(QUOTA_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
  }

  const [isQuotaExhausted, setIsQuotaExhausted] = useState(
    devForceQuota || persistedQuota,
  )

  const setQuotaExhausted = useCallback((): void => {
    setIsQuotaExhausted(true)
    try {
      localStorage.setItem(QUOTA_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
  }, [])

  const clearQuotaExhausted = useCallback((): void => {
    setIsQuotaExhausted(false)
    try {
      localStorage.removeItem(QUOTA_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  useQuotaRecovery(isQuotaExhausted, clearQuotaExhausted)

  const handleQuotaRetry = useCallback(async (): Promise<void> => {
    const firstVideoPreset = CHANNEL_PRESETS.find((p) => p.kind === 'video')
    if (!firstVideoPreset) return
    const { checkYouTubeQuota } = await import('~/routes/api/youtube')
    const { ok } = await checkYouTubeQuota({ data: { playlistId: firstVideoPreset.playlistId } })
    if (ok) clearQuotaExhausted()
  }, [clearQuotaExhausted])

  const { isFullscreen, toggleFullscreen } = useFullscreen()
  const [isTheater, setIsTheater] = useState(false)
  const isMobile = useIsMobile()
  const toggleTheater = useCallback((): void => {
    setIsTheater((prev) => {
      const fromMode = prev ? 'theater' : 'normal'
      const toMode = prev ? 'normal' : 'theater'
      trackViewModeChange(fromMode, toMode, 'button', isMobile)
      // Close the guide when entering theater so it doesn't appear immediately
      if (!prev) setGuideVisible(false)
      return !prev
    })
  }, [isMobile])
  const [overlayMode, setOverlayMode] = useLocalStorage<OverlayMode>(
    'kranz-tv:overlay-mode',
    'crt',
  )
  const isDesktop = useIsDesktop()
  const { needsOnboarding: needsDesktopOnboarding, dismissOnboarding: dismissDesktopOnboarding } = useOnboarding('desktop')
  const { isIdle } = useIdleTimeout({ enabled: isTheater && !isMobile })

  const viewMode: ViewMode = isTheater
    ? 'theater'
    : isFullscreen
      ? 'fullscreen'
      : 'normal'

  // null on server / first render — set real time after hydration to avoid mismatch.
  // 1s interval so the info panel title updates when the current video ends.
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])

  // One-time cleanup: delete the legacy IndexedDB database if it exists.
  // Tracks are now stored in localStorage with their channel; IDB is unused.
  useEffect(() => {
    if (typeof indexedDB !== 'undefined') {
      indexedDB.deleteDatabase('kranz-tv')
    }
    // Purge v1 cache keys (kranz-tv:channel-cache:*) — superseded by v2 keys
    // which store playlist order without the now-removed seededShuffle.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith('kranz-tv:channel-cache:')) {
        localStorage.removeItem(key)
      }
    }
  }, [])

  // Hydrate custom channels, cached preset channels, and visualizer preferences
  // from localStorage on mount. Fully synchronous.
  useEffect(() => {
    const stored = loadCustomChannels()
    setCustomChannels(stored)

    // Restore visualizer style + intensity from localStorage
    const params = new URLSearchParams(window.location.search)
    setActivePresetState(resolvePreset(params))
    setActiveIntensityState(resolveIntensity(params))

    setLoadedChannels((prev) => {
      const next = new Map(prev)
      for (const preset of CHANNEL_PRESETS) {
        if (next.has(preset.id)) continue
        const cached = loadCachedChannel(preset.id)
        if (cached !== null) {
          next.set(preset.id, cached)
          continue
        }
        // Music presets with no localStorage cache yet: synthesize a stub with
        // empty tracks so the channel appears in the guide on first load.
        // The eager fetch below fills in the real playlist.
        if (preset.kind === 'music') {
          next.set(preset.id, {
            kind: 'music',
            id: preset.id,
            number: preset.number,
            name: preset.name,
            source: 'soundcloud',
            sourceUrl: preset.sourceUrl,
            description: preset.description,
            totalDurationSeconds: 0,
            trackCount: 0,
            tracks: [],
          })
        }
      }
      for (const ch of stored) {
        if (!next.has(ch.id)) next.set(ch.id, ch)
      }
      return next
    })

    setHydrationDone(true)
  }, [])

  // Eagerly fetch all preset channels so the guide populates without needing to visit each one.
  // Sequential to allow early exit on quota exhaustion without firing doomed API calls.
  useEffect(() => {
    let cancelled = false
    let quotaExhausted = isQuotaExhausted

    // A previously-published music entry with no tracks is just the
    // synthesised stub from the hydration effect — treat it as "not really
    // present" so the eager fetch below can fill in the real playlist.
    const isMusicStub = (c: Channel | undefined): boolean =>
      c?.kind === 'music' && (c.tracks?.length ?? 0) === 0

    const fetchAll = async (): Promise<void> => {
      for (const preset of CHANNEL_PRESETS) {
        if (cancelled) break

        // Skip video presets when YT quota is exhausted. Music presets are
        // unaffected — they use the SoundCloud API, not YouTube.
        if (preset.kind === 'video' && quotaExhausted) continue

        // Serve the localStorage cache immediately so the guide isn't blank,
        // but always proceed to fetch — stale playlists (reordered, added/removed
        // videos) produce wrong schedules that only a fresh fetch can fix.
        const lsCached = loadCachedChannel(preset.id)
        if (lsCached !== null && !isMusicStub(lsCached)) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!cancelled) {
            setLoadedChannels((prev) => {
              const existing = prev.get(preset.id)
              if (existing !== undefined && !isMusicStub(existing)) return prev
              const next = new Map(prev)
              next.set(preset.id, lsCached)
              return next
            })
          }
          // Fall through to fetch — do NOT continue. We always want a fresh copy.
        }

        try {
          const channel = await buildChannel(preset)
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!cancelled) {
            saveCachedChannel(channel)
            // Fresh data is the source of truth for playlist order and content,
            // but we must not hot-swap a channel that is currently playing — that
            // shifts totalDurationSeconds mid-session and jolts now-playing. Stage
            // it instead and apply on next entry (see applyStagedChannel).
            setLoadedChannels((prev) => {
              if (prev.get(channel.id) === channel) return prev
              const existing = prev.get(channel.id)
              if (
                !shouldApplyImmediately(existing, activeChannelIdRef.current)
              ) {
                stagedChannelsRef.current.set(channel.id, channel)
                return prev
              }
              const next = new Map(prev)
              next.set(channel.id, channel)
              return next
            })
          }
        } catch (err) {
          if (err instanceof YouTubeQuotaError) {
            clearPresetChannelCache()
            setQuotaExhausted()
            quotaExhausted = true
            // Don't break — music presets after this still need to load
            continue
          }
          // Non-fatal — channel stays with cached/stub data in the guide
          logChannelLoadFailed(
            preset.id,
            err instanceof Error ? err.message : String(err),
          )
        }
      }
    }

    void fetchAll()

    return () => {
      cancelled = true
    }
  }, [isQuotaExhausted, setQuotaExhausted])

  // Promote any staged (deferred) fresh data for a channel into the live map.
  // Called when the user navigates into a channel — applying then is safe
  // because the schedule is recomputed from scratch on entry anyway.
  const applyStagedChannel = useCallback((channelId: string): void => {
    const staged = stagedChannelsRef.current.get(channelId)
    if (staged === undefined) return
    stagedChannelsRef.current.delete(channelId)
    setLoadedChannels((prev) => {
      const next = new Map(prev)
      next.set(channelId, staged)
      return next
    })
  }, [])

  // On entry into a channel, flush any data that was staged while it was the
  // active (playing) channel during a background revalidation.
  useEffect(() => {
    if (currentChannelId === null) return
    applyStagedChannel(currentChannelId)
  }, [currentChannelId, applyStagedChannel])

  const toggleGuide = useCallback((): void => {
    setGuideVisible((prev) => {
      trackGuideToggle(!prev)
      return !prev
    })
  }, [])

  const toggleImport = useCallback((): void => {
    setImportVisible((prev) => {
      if (!prev) trackImportStarted()
      return !prev
    })
  }, [])

  const toggleMute = useCallback((): void => {
    setIsMuted(!isMuted)
  }, [setIsMuted, isMuted])

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

  const addCustomChannels = useCallback(
    (channels: readonly Channel[]): void => {
      setCustomChannels((prev) => {
        const next = [...prev, ...channels]
        saveCustomChannels(next)
        return next
      })
      setLoadedChannels((prev) => {
        const next = new Map(prev)
        for (const channel of channels) {
          next.set(channel.id, channel)
        }
        return next
      })
    },
    [],
  )

  const removeCustomChannel = useCallback((id: string): void => {
    setCustomChannels((prev) => {
      const next = prev.filter((c) => c.id !== id)
      saveCustomChannels(next)
      return next
    })
    setLoadedChannels((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  const updateCustomChannel = useCallback(
    (id: string, updates: CustomChannelUpdates): void => {
      setCustomChannels((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
        saveCustomChannels(next)
        return next
      })
      setLoadedChannels((prev) => {
        const existing = prev.get(id)
        if (!existing) return prev
        const next = new Map(prev)
        next.set(id, { ...existing, ...updates })
        return next
      })
    },
    [],
  )

  const cycleOverlay = useCallback((): void => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = nextOverlayMode(overlayMode, reducedMotion)
    trackOverlayChange(overlayMode, next)
    setOverlayMode(next)
  }, [overlayMode, setOverlayMode])

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

  const handleRefreshChannel = useCallback(
    (id: string, updated: Channel): void => {
      setCustomChannels((prev) => {
        const next = prev.map((c) => (c.id === id ? updated : c))
        saveCustomChannels(next)
        return next
      })
      setLoadedChannels((prev) => {
        const next = new Map(prev)
        next.set(id, updated)
        return next
      })
    },
    [],
  )

  // Merge preset + custom channels for the guide
  const allPresets: ChannelPreset[] = useMemo(
    () => [...CHANNEL_PRESETS, ...customChannels.map(channelToPreset)],
    [customChannels],
  )

  // ── Surf Mode ──
  const navigationSourceRef = useRef<NavigationSource>('direct')
  const setNavigationSourceLayout = useCallback(
    (source: NavigationSource): void => {
      navigationSourceRef.current = source
    },
    [],
  )

  const isOverlayOpen = guideVisible || importVisible

  const surfChannels = useMemo(
    () => allPresets.map((p) => ({ id: p.id, number: p.number })),
    [allPresets],
  )

  const surfNavigate = useCallback(
    (channelId: string) =>
      void navigate({ to: '/channel/$channelId', params: { channelId } }),
    [navigate],
  )

  const surfMode = useSurfMode({
    allChannels: surfChannels,
    currentChannelId,
    navigate: surfNavigate,
    isOverlayOpen,
    isChannelLoading: false,
    setNavigationSource: setNavigationSourceLayout,
  })

  const handleSurfToggle = useCallback((): void => {
    if (surfMode.isSurfing) {
      surfMode.stopSurf()
    } else {
      surfMode.startSurf()
    }
  }, [surfMode])

  // Enrich all RUM events with viewer-level context
  useEffect(() => {
    setViewerContext({
      deviceType: isMobile ? 'mobile' : 'desktop',
      channelCount: allPresets.length,
    })
  }, [isMobile, allPresets.length])

  const currentPreset = currentChannelId
    ? allPresets.find((p) => p.id === currentChannelId)
    : undefined

  const currentChannel = currentChannelId
    ? loadedChannels.get(currentChannelId)
    : undefined

  // Derive the current position for the info panel. now ticks every 30s which is
  // fine for display — ChannelView has its own 1s tick for the player.
  const currentPosition = useMemo(
    () =>
      currentChannel != null && now != null
        ? getSchedulePosition(currentChannel, now)
        : null,
    [currentChannel, now],
  )

  const toolbarChannelText = currentPreset
    ? `— CH ${String(currentPreset.number).padStart(2, '0')} ${currentPreset.name.toUpperCase()}`
    : '— SELECT A CHANNEL'

  const isFullWidthLayout = isTheater || isFullscreen || !isDesktop

  const handleTheaterChannelUp = useCallback((): void => {
    const idx = allPresets.findIndex((p) => p.id === currentChannelId)
    if (idx === -1) return
    const prev = allPresets[(idx - 1 + allPresets.length) % allPresets.length]
    void navigate({ to: '/channel/$channelId', params: { channelId: prev.id } })
  }, [allPresets, currentChannelId, navigate])

  const handleTheaterChannelDown = useCallback((): void => {
    const idx = allPresets.findIndex((p) => p.id === currentChannelId)
    if (idx === -1) return
    const next = allPresets[(idx + 1) % allPresets.length]
    void navigate({ to: '/channel/$channelId', params: { channelId: next.id } })
  }, [allPresets, currentChannelId, navigate])

  const layoutShareDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const layoutToast = useToast()

  const handleShareFromLayout = useCallback((): void => {
    if (layoutShareDebounceRef.current !== null) return
    layoutShareDebounceRef.current = setTimeout(() => {
      layoutShareDebounceRef.current = null
    }, 500)
    const url = window.location.href
    void copyToClipboard(url).then((success) => {
      if (success) {
        layoutToast.show('LINK COPIED', url)
      } else {
        layoutToast.show('COPY FAILED')
      }
      trackShareChannel(currentChannelId ?? '', success)
    })
  }, [currentChannelId, layoutToast])

  // Boot-screen readiness: three signals to clear before showing the UI.
  // Each signal is independent — order doesn't matter. The boot screen
  // fades out only when all three are green.
  const firstChannelLoaded = loadedChannels.size > 0
  const bootPhases = [
    { label: 'HYDRATING STORAGE', done: hydrationDone },
    { label: 'WARMING SOUNDCLOUD', done: scReady },
    { label: 'LOADING CHANNELS', done: firstChannelLoaded },
  ] as const
  const bootDone = bootPhases.every((p) => p.done)

  // First-gesture unmute. Browsers block autoplay-with-sound until the
  // user interacts. Once they do (mouse/key/touch), flip isMuted off so
  // the active player (YouTube or the SC widget via the provider) plays
  // with audio. The SC provider observes isMuted directly and will
  // resume playback.
  const gestureHandledRef = useRef(false)
  useEffect(() => {
    if (!bootDone) return
    if (gestureHandledRef.current) return

    const onGesture = (): void => {
      if (gestureHandledRef.current) return
      gestureHandledRef.current = true
      setIsMuted(false)
      window.removeEventListener('mousedown', onGesture)
      window.removeEventListener('keydown', onGesture)
      window.removeEventListener('touchstart', onGesture)
    }
    window.addEventListener('mousedown', onGesture)
    window.addEventListener('keydown', onGesture)
    window.addEventListener('touchstart', onGesture)

    return () => {
      window.removeEventListener('mousedown', onGesture)
      window.removeEventListener('keydown', onGesture)
      window.removeEventListener('touchstart', onGesture)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootDone])

  return (
    <>
      {!bootDone && <BootScreen phases={bootPhases} />}
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
        addCustomChannels,
        removeCustomChannel,
        updateCustomChannel,
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
        navigationSource: navigationSourceRef.current,
        setNavigationSource: setNavigationSourceLayout,
        needsDesktopOnboarding,
        dismissDesktopOnboarding,
        activePreset,
        setActivePreset,
        activeIntensity,
        setActiveIntensity,
      }}
    >
      <SurfModeContext.Provider value={surfMode}>
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
                    style={{
                      flex: '2',
                      backgroundColor: '#050505',
                      isolation: 'isolate',
                    }}
                  >
                    <Outlet />
                    <OverlayCanvas mode={overlayMode} />
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
                      activePreset={activePreset}
                      onPresetChange={setActivePreset}
                      activeIntensity={activeIntensity}
                      onIntensityChange={setActiveIntensity}
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
                style={{ backgroundColor: '#050505', isolation: 'isolate' }}
              >
                <Outlet />
                {/* Retro overlay — scoped to the player area only */}
                <OverlayCanvas mode={overlayMode} />
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
            {/* Theater controls overlay — fades in on activity, out after 3s idle */}
            {isTheater && (
              <TheaterControls
                visible={!isIdle}
                channelNumber={currentPreset?.number ?? null}
                channelName={currentPreset?.name ?? null}
                onChannelUp={handleTheaterChannelUp}
                onChannelDown={handleTheaterChannelDown}
                onToggleGuide={toggleGuide}
                onCycleOverlay={cycleOverlay}
                onExitTheater={toggleTheater}
                volume={volume}
                isMuted={isMuted}
                onVolumeChange={setVolume}
                onToggleMute={toggleMute}
                onShare={handleShareFromLayout}
                onSurfToggle={handleSurfToggle}
                isSurfing={surfMode.isSurfing}
              />
            )}

            {/* Technical Difficulties banner — shown when YouTube quota is exhausted */}
            {!isFullscreen && !isTheater && (
              <QuotaBanner onRetry={handleQuotaRetry} />
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
                    <span>[S] SURF</span>
                    <span>[C] SHARE</span>
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
        )}{' '}
        {/* end !isMobile */}
        {/* Import modal — rendered at layout level so it's available on any channel */}
        <ImportModal
          visible={importVisible}
          onClose={() => setImportVisible(false)}
          onImportComplete={handleImportComplete}
          onRefreshChannel={handleRefreshChannel}
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
        {/* Welcome modal — rendered at layout level to avoid isolation: isolate stacking context in channel route */}
        {!isMobile && (
          <DesktopWelcome
            visible={needsDesktopOnboarding}
            onDismiss={dismissDesktopOnboarding}
          />
        )}
        <Toast
          visible={layoutToast.visible}
          message={layoutToast.message}
          detail={layoutToast.detail}
        />
      </SurfModeContext.Provider>
    </TvLayoutContext.Provider>
    </>
  )
}
