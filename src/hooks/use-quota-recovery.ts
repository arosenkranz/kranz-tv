import { useEffect } from 'react'
import { checkYouTubeQuota } from '~/routes/api/youtube'
import { CHANNEL_PRESETS } from '~/lib/channels/presets'
import { getMillisUntilMidnightPT } from '~/lib/channels/quota-recovery'
import { logQuotaRecovery } from '~/lib/datadog/logs'

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
): void {
  useEffect(() => {
    if (!isQuotaExhausted) return

    const probe = async (): Promise<void> => {
      const firstVideoPreset = CHANNEL_PRESETS.find((p) => p.kind === 'video')
      if (!firstVideoPreset) return

      const { ok } = await checkYouTubeQuota({ data: { playlistId: firstVideoPreset.playlistId } })
      if (ok) {
        logQuotaRecovery()
        clearQuotaExhausted()
        return
      }

      // Still exhausted — schedule another probe at next midnight PT + jitter
      const msUntilNext = getMillisUntilMidnightPT() + RETRY_JITTER_MS
      retryTimer = setTimeout(() => { void probe() }, msUntilNext)
    }

    const msUntilMidnightPT = getMillisUntilMidnightPT()
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const initialTimer = setTimeout(() => { void probe() }, msUntilMidnightPT)

    return () => {
      clearTimeout(initialTimer)
      if (retryTimer !== undefined) clearTimeout(retryTimer)
    }
  }, [isQuotaExhausted, clearQuotaExhausted])
}
