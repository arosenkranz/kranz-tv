import { useState, useEffect } from 'react'
import type { Channel, SchedulePosition } from '~/lib/scheduling/types'
import { getSchedulePosition } from '~/lib/scheduling/algorithm'

export function useCurrentProgram(channel: Channel | null): SchedulePosition | null {
  const [position, setPosition] = useState<SchedulePosition | null>(() => {
    if (channel === null) return null
    return getSchedulePosition(channel, new Date())
  })

  useEffect(() => {
    if (channel === null) {
      setPosition(null)
      return
    }

    // Sync immediately on channel change — no interval needed since
    // TvPlayer handles video transitions via onStateChange
    setPosition(getSchedulePosition(channel, new Date()))
  }, [channel])

  return position
}
