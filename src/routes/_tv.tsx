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
  fetchPlaylistVideoIds,
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
import { loadTracks, saveTracks } from '~/lib/storage/track-db'
import {
  ScWidgetProvider,
  useScWidget,
} from '~/lib/sources/soundcloud/sc-widget-context'
import { BootScreen } from '~/components/boot-screen'
import { channelToPreset } from '~/lib/import/schema'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'
import {
  trackGuideToggle,
  trackImportStarted,
  trackShareChannel,
  trackViewModeChange,
  trackOverlayChange,
  setViewerContext,
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
import type { ChannelPreset } from '~/lib/channels/types'
import { useSurfMode } from '~/hooks/use-surf-mode'
import { SurfModeContext } from '~/contexts/surf-mode-context'
import type { NavigationSource } from '~/hooks/use-channel-surf'
import type { Channel, Track } from '~/lib/scheduling/types'

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
 */
function TvLayoutWithProviders() {
  return (
    <ScWidgetProvider>
      <TvLayout />
    </ScWidgetProvider>
  )
}

export function TvLayout() {
  const navigate = useNavigate()
  const [guideVisible, setGuideVisible] = useState(true)
  const [importVisible, setImportVisible] = useState(false)
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null)
  const [loadedChannels, setLoadedChannels] = useState<Map<string, Channel>>(
    new Map(),
  )
  const [customChannels, setCustomChannels] = useState<readonly Channel[]>([])
  const [hydrationDone, setHydrationDone] = useState(false)
  const {
    isReady: scReady,
    widget: scWidget,
    status: scStatus,
  } = useScWidget()
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

  const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined
  useQuotaRecovery(isQuotaExhausted, clearQuotaExhausted, apiKey)

  const handleQuotaRetry = useCallback(async (): Promise<void> => {
    if (!apiKey || apiKey.trim() === '') throw new Error('No API key')
    const firstVideoPreset = CHANNEL_PRESETS.find((p) => p.kind === 'video')
    if (!firstVideoPreset) return
    await fetchPlaylistVideoIds(firstVideoPreset.playlistId, apiKey, 1)
    clearQuotaExhausted()
  }, [apiKey, clearQuotaExhausted])

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

  // Hydrate custom channels and cached preset channels from localStorage on mount.
  // Music channels need an extra IndexedDB load for their tracks array.
  useEffect(() => {
    const stored = loadCustomChannels()

    void (async () => {
      const hydrated: Channel[] = []
      for (const ch of stored) {
        if (ch.kind === 'music') {
          const tracks = await loadTracks(ch.id)
          hydrated.push(tracks ? { ...ch, tracks } : ch)
        } else {
          hydrated.push(ch)
        }
      }

      setCustomChannels(hydrated)

      // Rehydrate music presets' tracks from IndexedDB so they appear in the
      // guide immediately on reload, without waiting for the SC iframe import.
      const musicPresets = CHANNEL_PRESETS.filter((p) => p.kind === 'music')
      const musicTracksById = new Map<string, ReadonlyArray<Track>>()
      await Promise.all(
        musicPresets.map(async (p) => {
          const tracks = await loadTracks(p.id)
          if (tracks && tracks.length > 0) musicTracksById.set(p.id, tracks)
        }),
      )

      setLoadedChannels((prev) => {
        const next = new Map(prev)
        for (const preset of CHANNEL_PRESETS) {
          if (next.has(preset.id)) continue
          const cached = loadCachedChannel(preset.id)
          if (cached !== null) {
            next.set(preset.id, cached)
            continue
          }
          // Music presets: synthesize a Channel from preset metadata + IDB tracks
          if (preset.kind === 'music') {
            const tracks = musicTracksById.get(preset.id)
            if (tracks) {
              const totalDurationSeconds = tracks.reduce(
                (sum, t) => sum + t.durationSeconds,
                0,
              )
              next.set(preset.id, {
                kind: 'music',
                id: preset.id,
                number: preset.number,
                name: preset.name,
                source: 'soundcloud',
                sourceUrl: preset.sourceUrl,
                description: preset.description,
                totalDurationSeconds,
                trackCount: tracks.length,
                tracks,
              })
            }
          }
        }
        for (const ch of hydrated) {
          if (!next.has(ch.id)) next.set(ch.id, ch)
        }
        return next
      })

      // Mark hydration complete — the boot screen gates on this so the user
      // doesn't see a half-populated guide flash before content settles.
      setHydrationDone(true)
    })()
  }, [])

  // Eagerly fetch all preset channels so the guide populates without needing to visit each one.
  // Sequential to allow early exit on quota exhaustion without firing doomed API calls.
  useEffect(() => {
    let cancelled = false
    let quotaExhausted = isQuotaExhausted
    const hasApiKey = Boolean(apiKey && apiKey.trim() !== '')

    const fetchAll = async (): Promise<void> => {
      for (const preset of CHANNEL_PRESETS) {
        if (cancelled) break

        // Skip music presets in the eager-fetch loop — they import on-demand
        // when the user navigates to the channel route. Background-spawning
        // 6 SoundCloud iframes simultaneously caused widespread postMessage
        // contamination and racy SDK init.
        if (preset.kind === 'music') continue

        // Skip video presets when no API key OR YT quota is exhausted.
        if (!hasApiKey || quotaExhausted) continue

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
            // Music channels persist their tracks to IndexedDB so reloads find them
            if (channel.kind === 'music' && channel.tracks) {
              await saveTracks(channel.id, [...channel.tracks])
            }
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
            quotaExhausted = true
            // Don't break — music presets after this still need to load
            continue
          }
          // Non-fatal — channel stays as "Loading..." in the guide
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
  }, [apiKey, isQuotaExhausted, setQuotaExhausted])

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
  }, [setIsMuted])

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
      hasApiKey: Boolean(apiKey),
    })
  }, [isMobile, allPresets.length, apiKey])

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

  // Auto-unmute after boot. The SC widget needs the media payload to be
  // hydrated before play() works — seekTo(0) forces hydration as a side
  // effect, then play() reliably starts audio. Without the seekTo, play()
  // throws 'mediaPayload required' because the widget's internal <audio>
  // element doesn't have a src yet (READY fires before media is hydrated).
  //
  // We also retry on a longer schedule since SC's internal load phases
  // are not directly observable.
  // Run-once-on-boot guard. Critical: the effect must NOT depend on
  // rapidly-changing values (volume, isMuted) — those caused cleanup
  // to fire before the first timer could resolve. Using a ref to gate
  // a single execution path means the staggered timers actually run.
  const autoplayInitiatedRef = useRef(false)
  useEffect(() => {
    if (!bootDone || !scWidget) return
    if (autoplayInitiatedRef.current) return
    if (scStatus === 'playing') return
    autoplayInitiatedRef.current = true

    let resolved = false
    let attemptCount = 0

    const attemptUnmute = (label: string): void => {
      if (resolved || !scWidget) return
      attemptCount++
      console.info(`[autoplay] attempt ${attemptCount} (${label})`)
      // Synthesize a body click in the same tick as play() so SC's
      // iframe autoplay policy treats this as gesture-bound. Verified
      // via agent-browser: programmatic body.click() + widget.play()
      // succeeds where widget.play() alone is silently rejected.
      try {
        document.body.click()
      } catch {
        /* ignore */
      }
      scWidget.setVolume(volume)
      scWidget.play()
    }

    // Listen for the widget's play event to confirm autoplay actually
    // worked. Once we get one, stop retrying.
    let cleanupPlayListener: (() => void) | null = null
    if (scWidget) {
      const onPlay = (): void => {
        resolved = true
        console.info(`[autoplay] resolved after ${attemptCount} attempts`)
      }
      scWidget.on('play', onPlay)
      // No clean off() since the wrapper accumulates listeners harmlessly.
    }

    // Staggered attempts. The SC widget needs varying time depending on
    // network — first attempt at 3s, then back off.
    const t1 = setTimeout(() => attemptUnmute('3s'), 3000)
    const t2 = setTimeout(() => attemptUnmute('6s'), 6000)
    const t3 = setTimeout(() => {
      attemptUnmute('10s')
      // Flip muted state regardless — UI catches up even if SC silently
      // refused to play. User can then click to manually unmute.
      setIsMuted(false)
    }, 10000)

    // Fallback gesture listener — any user interaction triggers unmute
    // synchronously (which always satisfies autoplay policy).
    const unmuteOnFirstGesture = (): void => {
      resolved = true
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      console.info('[autoplay] resolving via user gesture')
      if (scWidget) {
        scWidget.seekTo(0)
        scWidget.setVolume(volume)
        scWidget.play()
      }
      setIsMuted(false)
      window.removeEventListener('mousedown', unmuteOnFirstGesture)
      window.removeEventListener('keydown', unmuteOnFirstGesture)
      window.removeEventListener('touchstart', unmuteOnFirstGesture)
    }
    window.addEventListener('mousedown', unmuteOnFirstGesture)
    window.addEventListener('keydown', unmuteOnFirstGesture)
    window.addEventListener('touchstart', unmuteOnFirstGesture)

    return () => {
      resolved = true
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      cleanupPlayListener?.()
      window.removeEventListener('mousedown', unmuteOnFirstGesture)
      window.removeEventListener('keydown', unmuteOnFirstGesture)
      window.removeEventListener('touchstart', unmuteOnFirstGesture)
    }
    // Deps intentionally omit volume/setIsMuted to keep the effect stable.
    // The closure captures volume at first run; if user changes it before
    // autoplay resolves, the SC widget's setVolume on the next mute toggle
    // will catch up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootDone, scStatus, scWidget])

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
