import { useEffect } from 'react'
import { fetchPlaylistVideoIds, YouTubeQuotaError } from '~/lib/channels/youtube-api'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import { getMillisUntilMidnightPT } from '~/lib/channels/quota-recovery'

const RETRY_JITTER_MS = 5 * 60 * 1_000 // 5 minutes

/**
 * Schedules a single API probe at the next YouTube quota reset (midnight PT).
 * When the probe succeeds, calls `clearQuotaExhausted()` to re-enable all
 * API calls across the app. If quota is still exhausted, retries at the
 * following midnight PT + 5-minute jitter.
 *
 * Only active when `isQuotaExhausted` is true.
 */
export function useQuotaRecovery(
  isQuotaExhausted: boolean,
  clearQuotaExhausted: () => void,
  apiKey: string | undefined,
): void {
  useEffect(() => {
    if (!isQuotaExhausted || !apiKey || apiKey.trim() === '') return

    const probe = async (): Promise<void> => {
      const firstPreset = CHANNEL_PRESETS[0]
      if (!firstPreset || !apiKey) return

      try {
        await fetchPlaylistVideoIds(firstPreset.playlistId, apiKey, 1)
        // Probe succeeded — quota has been restored
        console.info('[KranzTV] YouTube quota recovered — resuming normal operation')
        clearQuotaExhausted()
      } catch (err) {
        if (err instanceof YouTubeQuotaError) {
          // Still exhausted — schedule another probe at next midnight PT + jitter
          const msUntilNext = getMillisUntilMidnightPT() + RETRY_JITTER_MS
          console.info(
            `[KranzTV] Quota still exhausted — next recovery probe in ${Math.round(msUntilNext / 60_000)} min`,
          )
          retryTimer = setTimeout(() => { void probe() }, msUntilNext)
        }
        // Other errors (network, etc.) — don't retry; next page load will try again
      }
    }

    const msUntilMidnightPT = getMillisUntilMidnightPT()
    console.info(
      `[KranzTV] YouTube quota exhausted — recovery probe scheduled for midnight PT (${Math.round(msUntilMidnightPT / 60_000)} min)`,
    )

    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const initialTimer = setTimeout(() => { void probe() }, msUntilMidnightPT)

    return () => {
      clearTimeout(initialTimer)
      if (retryTimer !== undefined) clearTimeout(retryTimer)
    }
  }, [isQuotaExhausted, clearQuotaExhausted, apiKey])
}
