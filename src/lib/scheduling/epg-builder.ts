import type { Channel, EpgEntry, Track, Video } from './types'
import { getSchedulePosition } from './algorithm'

/**
 * Builds a list of EPG entries covering [windowStart, windowEnd].
 *
 * Each slot is computed by querying `getSchedulePosition` at 1ms past the
 * previous slot's end time, so the hourly rotation component of the schedule
 * is always correct for the slot's actual wall-clock time. Slots are never
 * synthesized by adding durations — the scheduler is the sole source of truth
 * for both item identity and slot boundaries.
 *
 * `isCurrentlyPlaying` is determined by time containment: `now` falls within
 * the entry's [startTime, endTime) range, matching exactly how the player
 * determines its position. This is robust against duplicate track IDs and
 * hour-boundary rotation shifts.
 *
 * Note: EpgEntry.video is preserved for backward compatibility with existing
 * EPG cell components. For music channels, video fields outside {id, durationSeconds}
 * will be empty strings.
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
  const nowMs = now.getTime()

  // Music channels with tracks not yet loaded have no items to schedule.
  if (channel.kind === 'music' && !channel.tracks?.length) return []

  const entries: EpgEntry[] = []

  // Find the first slot — the one containing windowStart.
  let pos = getSchedulePosition(channel, windowStart)

  while (pos.slotStartTime.getTime() < windowEndMs) {
    const slotEndMs = pos.slotEndTime.getTime()

    // Time-containment check: this slot is "now" if the current wall-clock
    // time falls within it. This matches how the player computes its position
    // and is unaffected by hourly rotation shifts or duplicate item IDs.
    const isCurrentlyPlaying = nowMs >= pos.slotStartTime.getTime() && nowMs < slotEndMs

    const video = pos.item as unknown as Video

    let label: string
    if (channel.kind === 'music') {
      const track = pos.item as Track
      label = track.artist ? `${track.title} — ${track.artist}` : track.title
    } else {
      label = video.title
    }

    entries.push({
      video,
      label,
      channelId: channel.id,
      startTime: pos.slotStartTime,
      endTime: pos.slotEndTime,
      isCurrentlyPlaying,
    })

    // Advance: query the scheduler 1ms past this slot's end so the hourly
    // rotation is correct for the next slot's wall-clock hour. Pin slotStartTime
    // to the previous slotEndTime so entries are gapless (no 1ms rounding gap).
    const nextPos = getSchedulePosition(channel, new Date(slotEndMs + 1))
    pos = {
      item: nextPos.item,
      seekSeconds: 0,
      slotStartTime: pos.slotEndTime,
      slotEndTime: new Date(slotEndMs + nextPos.item.durationSeconds * 1000),
    }
  }

  return entries
}
