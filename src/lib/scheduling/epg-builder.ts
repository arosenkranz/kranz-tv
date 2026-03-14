import type { Channel, EpgEntry } from './types'
import { getSchedulePosition } from './algorithm'

/**
 * Builds a list of EPG entries covering [windowStart, windowEnd].
 *
 * Starting from the video slot that contains `windowStart`, it walks forward
 * through successive slots until the window is fully covered. Each slot is
 * computed deterministically via `getSchedulePosition`.
 *
 * To avoid gaps caused by the daily rotation shift at UTC midnight, each
 * successive slot is queried at `slotStartTime + 1s` rather than at the
 * previous slot's `endTime`. This ensures the lookup always falls cleanly
 * inside the next slot regardless of day boundaries.
 *
 * @param channel     - The channel to build the guide for.
 * @param windowStart - Start of the desired EPG window (inclusive).
 * @param windowEnd   - End of the desired EPG window (exclusive).
 * @param now         - The current real-world time, used to set `isCurrentlyPlaying`.
 */
export function buildEpgEntries(
  channel: Channel,
  windowStart: Date,
  windowEnd: Date,
  now: Date,
): ReadonlyArray<EpgEntry> {
  const windowEndMs = windowEnd.getTime()

  // Determine what is ACTUALLY playing right now using a fresh lookup.
  // We cannot rely on slot-time comparisons because the daily rotation
  // (dayOffset = daysSinceEpoch * 127 % total) changes at UTC midnight —
  // EPG entries built from windowStart (which may be yesterday) will have
  // slot times that don't align with today's rotation.
  const currentPos = getSchedulePosition(channel, now)
  const currentVideoId = currentPos.video.id

  const entries: EpgEntry[] = []

  // Find the first slot — the one containing windowStart
  let pos = getSchedulePosition(channel, windowStart)

  while (pos.slotStartTime.getTime() < windowEndMs) {
    const slotEndMs = pos.slotEndTime.getTime()

    // Mark as currently playing only if this entry's video matches what the
    // algorithm says is actually playing right now. This handles the midnight
    // rotation boundary correctly regardless of how slot times were stitched.
    const isCurrentlyPlaying = pos.video.id === currentVideoId

    entries.push({
      video: pos.video,
      channelId: channel.id,
      startTime: pos.slotStartTime,
      endTime: pos.slotEndTime,
      isCurrentlyPlaying,
    })

    // Advance to the next slot by querying 1ms into the next slot.
    // Using slotEnd + 1ms rather than slotEnd itself avoids ambiguity at
    // exact day boundaries where cyclePos could resolve to the wrong side.
    const nextTs = new Date(slotEndMs + 1)
    const nextPos = getSchedulePosition(channel, nextTs)

    // Stitch: force the next slot's startTime to be exactly this slot's endTime
    // so there are no ms-level gaps introduced by the +1 probe.
    // The remaining duration is the video's full length minus however far in we are.
    const remainingMs =
      (nextPos.video.durationSeconds - nextPos.seekSeconds) * 1000
    pos = {
      video: nextPos.video,
      seekSeconds: nextPos.seekSeconds,
      slotStartTime: pos.slotEndTime,
      slotEndTime: new Date(slotEndMs + remainingMs),
    }
  }

  return entries
}
