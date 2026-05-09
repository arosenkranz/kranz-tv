import type { Channel, EpgEntry, Track, Video } from './types'
import { getSchedulePosition } from './algorithm'

/**
 * Builds a list of EPG entries covering [windowStart, windowEnd].
 *
 * Each successive slot is re-anchored via a fresh getSchedulePosition lookup
 * at (previous slot end + 1ms). This guarantees every entry's boundaries
 * match what getSchedulePosition would report at that timestamp, including
 * across rotation-seed discontinuities (hourly + daily shifts in
 * getDailyRotationSeed).
 *
 * Discontinuities cause the modular cycle to "jump", producing a real gap
 * between the previous slot's true end and the next slot's true start. To
 * keep the visible guide gap-free, we extend the previous entry's endTime
 * to meet the next entry's startTime. This preserves the contract that the
 * *current* slot's endTime reflects when the *current* item ends — only
 * past slots get their displayed length adjusted to absorb the gap.
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

  // Music channels with tracks not yet loaded from IndexedDB have no items to schedule.
  if (channel.kind === 'music' && !channel.tracks?.length) return []

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

    // Advance by re-anchoring. The next position's slotStartTime may differ
    // from this slot's end (rotation-seed jump at hour/day boundary). Patch
    // the just-pushed entry's endTime to absorb any gap so the guide stays
    // visually contiguous, while keeping the *current* (now-playing) slot's
    // endTime accurate.
    pos = getSchedulePosition(channel, new Date(slotEndMs + 1))
    const last = entries[entries.length - 1]
    if (
      pos.slotStartTime.getTime() !== last.endTime.getTime() &&
      !last.isCurrentlyPlaying
    ) {
      entries[entries.length - 1] = {
        ...last,
        endTime: pos.slotStartTime,
      }
    }
  }

  return entries
}
