import type { Channel, EpgEntry, Track, Video } from './types'
import { getSchedulePosition } from './algorithm'

/**
 * Builds a list of EPG entries covering [windowStart, windowEnd].
 *
 * Starting from the item slot that contains `windowStart`, it walks forward
 * through successive slots until the window is fully covered. Each slot is
 * computed deterministically via `getSchedulePosition`.
 *
 * To avoid gaps caused by the daily rotation shift at UTC midnight, each
 * successive slot is queried at `slotStartTime + 1s` rather than at the
 * previous slot's `endTime`. This ensures the lookup always falls cleanly
 * inside the next slot regardless of day boundaries.
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

  // Determine what is ACTUALLY playing right now using a fresh lookup.
  const currentPos = getSchedulePosition(channel, now)
  const currentItemId = currentPos.item.id

  const entries: EpgEntry[] = []

  // Find the first slot — the one containing windowStart
  let pos = getSchedulePosition(channel, windowStart)

  while (pos.slotStartTime.getTime() < windowEndMs) {
    const slotEndMs = pos.slotEndTime.getTime()

    // Mark as currently playing only if this entry's item matches what the
    // algorithm says is actually playing right now.
    const isCurrentlyPlaying = pos.item.id === currentItemId

    // Adapt Schedulable item to Video shape for backward compat.
    // For VideoChannel, item is already a Video with all fields.
    // For MusicChannel, we synthesize a Video-shaped object.
    const video = pos.item as unknown as Video

    // Build a human-readable label. Music tracks show "Title — Artist".
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

    // Advance to the next slot by querying 1ms into the next slot.
    const nextTs = new Date(slotEndMs + 1)
    const nextPos = getSchedulePosition(channel, nextTs)

    pos = {
      item: nextPos.item,
      seekSeconds: 0,
      slotStartTime: pos.slotEndTime,
      slotEndTime: new Date(slotEndMs + nextPos.item.durationSeconds * 1000),
    }
  }

  return entries
}
