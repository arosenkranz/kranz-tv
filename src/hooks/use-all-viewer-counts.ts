import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_INTERVAL_MS = 15_000

export function useAllViewerCounts(): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/viewer-counts')
      if (!res.ok) return

      const data = (await res.json()) as { counts?: Record<string, number> }
      if (data.counts) {
        setCounts(data.counts)
      }
    } catch {
      // Silently fail — stale counts are fine for the guide
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    void fetchCounts()
    timerRef.current = setInterval(() => void fetchCounts(), POLL_INTERVAL_MS)

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
      }
    }
  }, [fetchCounts])

  return counts
}
