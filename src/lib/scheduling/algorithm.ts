import type {
  Channel,
  MusicChannel,
  Schedulable,
  SchedulePosition,
  VideoChannel,
} from './types'
import { getSecondsSinceMidnightUTC, getDailyRotationSeed } from './time-utils'

/**
 * Extracts a flat array of schedulable items from any channel type.
 * Algorithm body only cares about id + durationSeconds — both Video and Track satisfy Schedulable.
 */
function toSchedulableItems(channel: Channel): ReadonlyArray<Schedulable> {
  if (channel.kind === 'video') {
    return (channel).videos
  }
  return (channel).tracks ?? []
}

/**
 * Returns the item playing on `channel` at `timestamp` along with the
 * seek position and slot boundaries.
 *
 * Pure function — no side effects, never calls Date.now() internally.
 *
 * Algorithm:
 * 1. secSinceMidnight = seconds elapsed since UTC midnight of timestamp
 * 2. dayOffset        = (daysSinceEpoch * 7919) % totalDurationSeconds
 * 3. cyclePos         = (secSinceMidnight + dayOffset) % totalDurationSeconds
 * 4. Walk items accumulating durations until accumulated + item.durationSeconds > cyclePos
 * 5. seekSeconds      = cyclePos - accumulated
 * 6. slotStartTime    = timestamp − seekSeconds
 * 7. slotEndTime      = slotStartTime + item.durationSeconds
 */
export function getSchedulePosition(
  channel: Channel,
  timestamp: Date,
): SchedulePosition {
  const items = toSchedulableItems(channel)
  const secSinceMidnight = getSecondsSinceMidnightUTC(timestamp)
  const dayOffset = getDailyRotationSeed(
    timestamp,
    channel.totalDurationSeconds,
  )
  const cyclePos = (secSinceMidnight + dayOffset) % channel.totalDurationSeconds

  let accumulated = 0
  for (const item of items) {
    if (accumulated + item.durationSeconds > cyclePos) {
      const seekSeconds = cyclePos - accumulated
      const slotStartTime = new Date(timestamp.getTime() - seekSeconds * 1000)
      const slotEndTime = new Date(
        slotStartTime.getTime() + item.durationSeconds * 1000,
      )
      return { item, seekSeconds, slotStartTime, slotEndTime }
    }
    accumulated += item.durationSeconds
  }

  // Fallback: only reachable if totalDurationSeconds is mis-set relative to
  // the actual sum of item durations. Returns the last item at seek 0.
  const lastItem = items[items.length - 1]
  const slotStartTime = new Date(timestamp)
  const slotEndTime = new Date(
    slotStartTime.getTime() + lastItem.durationSeconds * 1000,
  )
  return { item: lastItem, seekSeconds: 0, slotStartTime, slotEndTime }
}
