import { useState, useCallback, useRef, useEffect } from 'react'
import { createShuffleQueue } from '~/lib/surf/shuffle'
import {
  trackSurfModeStart,
  trackSurfModeStop,
  trackSurfHop,
  trackSurfDwellChange,
} from '~/lib/datadog/rum'
import { useLocalStorage } from '~/hooks/use-local-storage'
import type { ChannelNavEntry } from '~/hooks/use-channel-navigation'
import type { NavigationSource } from '~/hooks/use-channel-surf'

export interface UseSurfModeOptions {
  readonly allChannels: readonly ChannelNavEntry[]
  readonly currentChannelId: string | null
  readonly navigate: (channelId: string) => void
  readonly isOverlayOpen: boolean
  readonly isChannelLoading: boolean
  readonly setNavigationSource: (source: NavigationSource) => void
}

export interface UseSurfModeReturn {
  readonly isSurfing: boolean
  readonly countdown: number
  readonly dwellSeconds: number
  readonly startSurf: () => void
  readonly stopSurf: () => void
  readonly setDwellSeconds: (seconds: number) => void
}

const DWELL_MIN = 5
const DWELL_MAX = 60
const TOGGLE_DEBOUNCE_MS = 150
const TICK_INTERVAL_MS = 1000
const DEFAULT_DWELL = 15

function clampDwell(seconds: number): number {
  return Math.max(DWELL_MIN, Math.min(DWELL_MAX, seconds))
}

export function useSurfMode(options: UseSurfModeOptions): UseSurfModeReturn {
  const {
    allChannels,
    currentChannelId,
    navigate,
    isOverlayOpen,
    isChannelLoading: _isChannelLoading,
    setNavigationSource,
  } = options

  const [isSurfing, setIsSurfing] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [storedDwell, setStoredDwell] = useLocalStorage<number>(
    'kranz-tv:surf-dwell',
    DEFAULT_DWELL,
  )

  const dwellSeconds = clampDwell(storedDwell)

  const queueRef = useRef<string[]>([])
  const queueIndexRef = useRef(0)
  const hopDeadlineRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toggleTimestampRef = useRef(0)
  const surfStartTimeRef = useRef(0)
  const channelsVisitedRef = useRef(0)
  const overlayPauseRemainingRef = useRef(0)
  const prevChannelCountRef = useRef(allChannels.length)

  // Rebuild queue when channel list changes during surf
  useEffect(() => {
    if (!isSurfing) return
    if (allChannels.length === prevChannelCountRef.current) return
    prevChannelCountRef.current = allChannels.length

    const ids = allChannels.map((c) => c.id)
    queueRef.current = createShuffleQueue(ids, currentChannelId ?? '')
    queueIndexRef.current = 0
  }, [allChannels.length, isSurfing, currentChannelId, allChannels])

  // Handle overlay pause/resume
  useEffect(() => {
    if (!isSurfing) return

    if (isOverlayOpen) {
      const remaining = hopDeadlineRef.current - Date.now()
      overlayPauseRemainingRef.current = Math.max(0, remaining)
    } else if (overlayPauseRemainingRef.current > 0) {
      hopDeadlineRef.current = Date.now() + overlayPauseRemainingRef.current
      overlayPauseRemainingRef.current = 0
    }
  }, [isOverlayOpen, isSurfing])

  // Main timer effect
  useEffect(() => {
    if (!isSurfing) return

    const id = setInterval(() => {
      if (isOverlayOpen) return

      const now = Date.now()
      const remaining = Math.max(
        0,
        Math.ceil((hopDeadlineRef.current - now) / 1000),
      )
      setCountdown(remaining)

      if (now >= hopDeadlineRef.current) {
        const queue = queueRef.current
        if (queue.length === 0) return

        let nextIndex = queueIndexRef.current
        if (nextIndex >= queue.length) {
          const ids = allChannels.map((c) => c.id)
          queueRef.current = createShuffleQueue(ids, currentChannelId ?? '')
          queueIndexRef.current = 0
          nextIndex = 0
          if (queueRef.current.length === 0) return
        }

        const nextChannelId = queueRef.current[nextIndex]!
        queueIndexRef.current = nextIndex + 1
        channelsVisitedRef.current += 1

        trackSurfHop(
          currentChannelId ?? '',
          nextChannelId,
          nextIndex,
          queueRef.current.length,
        )

        setNavigationSource('surf')
        navigate(nextChannelId)

        hopDeadlineRef.current = Date.now() + dwellSeconds * 1000
        setCountdown(dwellSeconds)
      }
    }, TICK_INTERVAL_MS)

    intervalRef.current = id
    return () => {
      clearInterval(id)
      intervalRef.current = null
    }
  }, [
    isSurfing,
    isOverlayOpen,
    allChannels,
    currentChannelId,
    navigate,
    setNavigationSource,
    dwellSeconds,
  ])

  const startSurf = useCallback((): void => {
    const now = Date.now()
    if (now - toggleTimestampRef.current < TOGGLE_DEBOUNCE_MS) return
    toggleTimestampRef.current = now

    if (allChannels.length < 2) return

    const ids = allChannels.map((c) => c.id)
    const queue = createShuffleQueue(ids, currentChannelId ?? '')
    if (queue.length === 0) return

    queueRef.current = queue
    queueIndexRef.current = 0
    hopDeadlineRef.current = Date.now() + dwellSeconds * 1000
    surfStartTimeRef.current = Date.now()
    channelsVisitedRef.current = 0

    setIsSurfing(true)
    setCountdown(dwellSeconds)

    trackSurfModeStart(dwellSeconds, allChannels.length, 'keyboard')
  }, [allChannels, currentChannelId, dwellSeconds])

  const stopSurf = useCallback((): void => {
    const now = Date.now()
    if (now - toggleTimestampRef.current < TOGGLE_DEBOUNCE_MS) return
    toggleTimestampRef.current = now

    if (!isSurfing) return

    setIsSurfing(false)
    setCountdown(0)

    const duration = Math.round(
      (Date.now() - surfStartTimeRef.current) / 1000,
    )
    trackSurfModeStop(channelsVisitedRef.current, duration, 'toggle')
  }, [isSurfing])

  const handleSetDwellSeconds = useCallback(
    (seconds: number): void => {
      const clamped = clampDwell(seconds)
      const old = dwellSeconds
      if (clamped === old) return
      setStoredDwell(clamped)

      if (isSurfing) {
        const remaining = hopDeadlineRef.current - Date.now()
        const ratio = clamped / old
        hopDeadlineRef.current = Date.now() + remaining * ratio
      }

      trackSurfDwellChange(clamped, old, 'keyboard')
    },
    [dwellSeconds, isSurfing, setStoredDwell],
  )

  return {
    isSurfing,
    countdown,
    dwellSeconds,
    startSurf,
    stopSurf,
    setDwellSeconds: handleSetDwellSeconds,
  }
}
