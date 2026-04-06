import { useState, useEffect } from 'react'
import { getMillisUntilMidnightPT } from '~/lib/channels/quota-recovery'

function formatCountdown(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `~${minutes}m`
  return `~${hours}h ${minutes}m`
}

/**
 * Returns a human-readable countdown string until YouTube quota resets
 * at midnight Pacific Time, or null when inactive.
 *
 * Refreshes every 60 seconds — minute-level precision is sufficient
 * since YouTube's actual reset time varies slightly.
 */
export function useQuotaCountdown(isActive: boolean): string | null {
  const [countdown, setCountdown] = useState<string | null>(() =>
    isActive ? formatCountdown(getMillisUntilMidnightPT()) : null,
  )

  useEffect(() => {
    if (!isActive) {
      setCountdown(null)
      return
    }

    setCountdown(formatCountdown(getMillisUntilMidnightPT()))
    const interval = setInterval(() => {
      setCountdown(formatCountdown(getMillisUntilMidnightPT()))
    }, 60_000)

    return () => clearInterval(interval)
  }, [isActive])

  return countdown
}
