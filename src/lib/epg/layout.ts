import type { EpgEntry } from '~/lib/scheduling/types'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Computes left/width percentages for an EPG entry within a time window.
 * Returns null if the entry falls entirely outside the window.
 */
export function computeCellLayout(
  entry: EpgEntry,
  windowStart: Date,
  windowEnd: Date,
): { leftPct: number; widthPct: number } | null {
  const startMs = windowStart.getTime()
  const endMs = windowEnd.getTime()
  const windowDuration = endMs - startMs

  if (windowDuration <= 0) return null

  const entryStart = entry.startTime.getTime()
  const entryEnd = entry.endTime.getTime()

  if (entryEnd <= startMs || entryStart >= endMs) return null

  const visibleStart = clamp(entryStart, startMs, endMs)
  const visibleEnd = clamp(entryEnd, startMs, endMs)

  const leftPct = ((visibleStart - startMs) / windowDuration) * 100
  const widthPct = ((visibleEnd - visibleStart) / windowDuration) * 100

  return { leftPct, widthPct }
}
