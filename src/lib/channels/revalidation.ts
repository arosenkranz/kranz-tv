import type { Channel } from '~/lib/scheduling/types'

// Decide whether a freshly-fetched channel may replace the one in the live map
// right now, or must be staged for next entry. We never hot-swap a channel that
// is currently active AND already has real data, because changing
// totalDurationSeconds mid-session shifts the schedule modulus and jolts
// now-playing. Stub/empty entries (no real data yet) are always safe to apply.
export function shouldApplyImmediately(
  existing: Channel | undefined,
  activeChannelId: string | null,
): boolean {
  const isActive = existing?.id === activeChannelId
  const existingHasRealData =
    existing !== undefined &&
    !(existing.kind === 'music' && (existing.tracks?.length ?? 0) === 0)
  if (isActive && existingHasRealData) return false
  return true
}
