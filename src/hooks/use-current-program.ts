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

    // Sync immediately on channel change
    setPosition(getSchedulePosition(channel, new Date()))

    const id = setInterval(() => {
      setPosition(getSchedulePosition(channel, new Date()))
    }, 1000)

    return () => clearInterval(id)
  }, [channel])

  return position
}
