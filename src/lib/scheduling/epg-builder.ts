import type { Channel, EpgEntry, Schedulable, Track, Video } from './types'
import { getSchedulePosition } from './algorithm'

interface Slot {
  readonly item: Schedulable
  readonly startTime: Date
  readonly endTime: Date
}

function makeEntry(channel: Channel, slot: Slot, now: Date): EpgEntry {
  // EpgEntry.video is preserved for backward compatibility with existing
  // EPG cell components. For music channels, video fields outside {id, durationSeconds}
  // will be empty strings.
  const video = slot.item as unknown as Video

  let label: string
  if (channel.kind === 'music') {
    const track = slot.item as Track
    label = track.artist ? `${track.title} — ${track.artist}` : track.title
  } else {
    label = video.title
  }

  const nowMs = now.getTime()
  const isCurrentlyPlaying =
    slot.startTime.getTime() <= nowMs && slot.endTime.getTime() > nowMs

  return {
    video,
    label,
    channelId: channel.id,
    startTime: slot.startTime,
    endTime: slot.endTime,
    isCurrentlyPlaying,
  }
}

/**
 * Builds a list of EPG entries covering [windowStart, windowEnd].
 *
 * Anchors on `now` rather than `windowStart`: `getSchedulePosition(now)` is
 * the authoritative source of what is *actually* playing right now, including
 * the correct slotStartTime/slotEndTime. The walk then radiates outward
 * (backward + forward), stitching contiguous slots until the window is
 * covered.
 *
 * Anchoring on `now` matters because the schedule can be discontinuous at
 * UTC hour boundaries (see `getDailyRotationSeed`'s hourly component) — a
 * walk starting at `windowStart` and stitching forward across an hour
 * boundary would place the currently-playing cell at the stitch point
 * instead of its real scheduled position.
 *
 * @param channel     - The channel to build the guide for.
 * @param windowStart - Start of the desired EPG window (inclusive).
 * @param windowEnd   - End of the desired EPG window (exclusive).
 * @param now         - The current real-world time. Determines isCurrentlyPlaying
 *                      and anchors the walk.
 */
export function buildEpgEntries(
  channel: Channel,
  windowStart: Date,
  windowEnd: Date,
  now: Date,
): ReadonlyArray<EpgEntry> {
  // Music channels with tracks not yet loaded from IndexedDB have no items to schedule.
  if (channel.kind === 'music' && !channel.tracks?.length) return []

  const windowStartMs = windowStart.getTime()
  const windowEndMs = windowEnd.getTime()

  const anchor = getSchedulePosition(channel, now)
  if (anchor.item.durationSeconds <= 0) return []

  const slots: Slot[] = [
    {
      item: anchor.item,
      startTime: anchor.slotStartTime,
      endTime: anchor.slotEndTime,
    },
  ]

  // Safety cap — prevents runaway loops if a degenerate item slips in.
  const MAX_WALK = 10_000

  // Walk backward, stitching each previous slot to end exactly at the next slot's start.
  // We query getSchedulePosition just before the cursor so we pick up the right
  // item from whichever hourly seed applies at that instant.
  let prevStartMs = anchor.slotStartTime.getTime()
  for (let i = 0; i < MAX_WALK && prevStartMs > windowStartMs; i++) {
    const probePos = getSchedulePosition(channel, new Date(prevStartMs - 1))
    const item = probePos.item
    if (item.durationSeconds <= 0) break
    const startMs = prevStartMs - item.durationSeconds * 1000
    slots.unshift({
      item,
      startTime: new Date(startMs),
      endTime: new Date(prevStartMs),
    })
    prevStartMs = startMs
  }

  // Walk forward, stitching each next slot to start exactly at the previous slot's end.
  let nextEndMs = anchor.slotEndTime.getTime()
  for (let i = 0; i < MAX_WALK && nextEndMs < windowEndMs; i++) {
    const probePos = getSchedulePosition(channel, new Date(nextEndMs + 1))
    const item = probePos.item
    if (item.durationSeconds <= 0) break
    const endMs = nextEndMs + item.durationSeconds * 1000
    slots.push({
      item,
      startTime: new Date(nextEndMs),
      endTime: new Date(endMs),
    })
    nextEndMs = endMs
  }

  // Keep only slots that overlap the window. The anchor entry may itself
  // be outside the window if `now` is far away (see edge-case test).
  return slots
    .filter(
      (s) =>
        s.endTime.getTime() > windowStartMs &&
        s.startTime.getTime() < windowEndMs,
    )
    .map((s) => makeEntry(channel, s, now))
}
