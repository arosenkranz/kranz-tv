import type { Channel } from '~/lib/scheduling/types'

/**
 * True when a music channel is present but has no tracks — the "stub" state
 * used both while the SoundCloud playlist load is in flight and (until the
 * failed-set records otherwise) when it has failed. Centralized here to kill
 * the previously-duplicated inline check across the layout and channel route.
 */
export function isMusicStub(channel: Channel | undefined): boolean {
  return channel?.kind === 'music' && (channel.tracks?.length ?? 0) === 0
}

/** Immutably add an id to a failed-channels set. */
export function addFailed(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set)
  next.add(id)
  return next
}

/** Immutably remove an id from a failed-channels set. */
export function clearFailed(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set)
  next.delete(id)
  return next
}
