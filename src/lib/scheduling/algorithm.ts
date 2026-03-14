import type { Channel, SchedulePosition } from './types'
import { getSecondsSinceMidnightUTC, getDailyRotationSeed } from './time-utils'

/**
 * Returns the video playing on `channel` at `timestamp` along with the
 * seek position and slot boundaries.
 *
 * Pure function — no side effects, never calls Date.now() internally.
 *
 * Algorithm:
 * 1. secSinceMidnight = seconds elapsed since UTC midnight of timestamp
 * 2. dayOffset        = (daysSinceEpoch * 127) % totalDurationSeconds
 * 3. cyclePos         = (secSinceMidnight + dayOffset) % totalDurationSeconds
 * 4. Walk videos accumulating durations until accumulated + video.durationSeconds > cyclePos
 * 5. seekSeconds      = cyclePos - accumulated
 * 6. slotStartTime    = timestamp − seekSeconds
 * 7. slotEndTime      = slotStartTime + video.durationSeconds
 */
export function getSchedulePosition(
  channel: Channel,
  timestamp: Date,
): SchedulePosition {
  const secSinceMidnight = getSecondsSinceMidnightUTC(timestamp)
  const dayOffset = getDailyRotationSeed(
    timestamp,
    channel.totalDurationSeconds,
  )
  const cyclePos = (secSinceMidnight + dayOffset) % channel.totalDurationSeconds

  let accumulated = 0
  for (const video of channel.videos) {
    if (accumulated + video.durationSeconds > cyclePos) {
      const seekSeconds = cyclePos - accumulated
      const slotStartTime = new Date(timestamp.getTime() - seekSeconds * 1000)
      const slotEndTime = new Date(
        slotStartTime.getTime() + video.durationSeconds * 1000,
      )
      return { video, seekSeconds, slotStartTime, slotEndTime }
    }
    accumulated += video.durationSeconds
  }

  // Fallback: only reachable if totalDurationSeconds is mis-set relative to
  // the actual sum of video durations. Returns the last video at seek 0.
  const lastVideo = channel.videos[channel.videos.length - 1]
  const slotStartTime = new Date(timestamp)
  const slotEndTime = new Date(
    slotStartTime.getTime() + lastVideo.durationSeconds * 1000,
  )
  return { video: lastVideo, seekSeconds: 0, slotStartTime, slotEndTime }
}
