import { useState, useCallback, useRef } from 'react'
import type { ChannelPreset } from '~/lib/channels/types'

export type NavigationSource = 'keyboard' | 'direct'

const STATIC_DURATION_MS = 370
const OSD_LINGER_MS = 2000
const SURF_QUIET_MS = 300

export interface ChannelSurfState {
  readonly showStatic: boolean
  readonly showOsd: boolean
  readonly channel: ChannelPreset | null
}

export interface UseChannelSurfResult {
  readonly surfState: ChannelSurfState
  readonly setNavigationSource: (source: NavigationSource) => void
  readonly triggerSurf: (channel: ChannelPreset) => void
}

export function useChannelSurf(): UseChannelSurfResult {
  const sourceRef = useRef<NavigationSource>('direct')
  const staticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const quietTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [showStatic, setShowStatic] = useState(false)
  const [showOsd, setShowOsd] = useState(false)
  const [channel, setChannel] = useState<ChannelPreset | null>(null)

  const setNavigationSource = useCallback((source: NavigationSource): void => {
    sourceRef.current = source
  }, [])

  const triggerSurf = useCallback((nextChannel: ChannelPreset): void => {
    // Only animate for keyboard (surfing) navigation
    if (sourceRef.current !== 'keyboard') {
      // Reset source for next navigation
      sourceRef.current = 'direct'
      return
    }

    // Reset source for next navigation
    sourceRef.current = 'direct'

    // Update OSD text immediately (snappy feel during rapid surfing)
    setChannel(nextChannel)

    // Show static burst — clear any pending hide timer
    if (staticTimerRef.current !== null) clearTimeout(staticTimerRef.current)
    setShowStatic(true)

    // Show OSD — clear any pending fade timer
    if (osdTimerRef.current !== null) clearTimeout(osdTimerRef.current)
    setShowOsd(true)

    // Clear any pending quiet-period timer
    if (quietTimerRef.current !== null) clearTimeout(quietTimerRef.current)

    // Start the quiet-period timer — when the user stops surfing for SURF_QUIET_MS,
    // begin the static fade and schedule the OSD fade
    quietTimerRef.current = setTimeout(() => {
      // Fade out static after the quiet period
      staticTimerRef.current = setTimeout(
        () => setShowStatic(false),
        STATIC_DURATION_MS,
      )

      // Schedule OSD fade after linger period
      osdTimerRef.current = setTimeout(
        () => setShowOsd(false),
        OSD_LINGER_MS,
      )
    }, SURF_QUIET_MS)
  }, [])

  return {
    surfState: { showStatic, showOsd, channel },
    setNavigationSource,
    triggerSurf,
  }
}
