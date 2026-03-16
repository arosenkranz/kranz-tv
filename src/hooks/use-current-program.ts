import { useState, useEffect } from 'react'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'

export function useCurrentProgram(
  channel: Channel | null,
): SchedulePosition | null {
  // Compute position synchronously during render — getSchedulePosition is pure
  // and takes ~microseconds, so it's safe to call on every render. This avoids
  // the one-render stale-state window that the useState+useEffect pattern caused
  // when TanStack Router reuses this component across channelId changes.
  const position = channel !== null
    ? getSchedulePosition(channel, new Date())
    : null

  // Tick every second to force a re-render so the live position stays current.
  // Use channel.id (stable string) instead of the channel object to avoid
  // infinite loops when the channel object reference changes on every render.
  const channelId = channel?.id ?? null
  const [, setTick] = useState(0)
  useEffect(() => {
    if (channelId === null) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [channelId])

  return position
}
