/**
 * Creates a shuffled queue of channel IDs for surf mode.
 *
 * Uses Fisher-Yates shuffle on a copy of the input array (never mutates).
 * The excluded channel (typically the one currently playing) is filtered out
 * before shuffling, so the viewer always surfs to a different channel.
 *
 * @param channelIds  - All available channel IDs
 * @param excludeId   - Channel to exclude (e.g. the current one)
 * @param random      - Injectable RNG for testing; defaults to Math.random
 * @returns Shuffled array of channel IDs, excluding `excludeId`
 */
export function createShuffleQueue(
  channelIds: readonly string[],
  excludeId: string,
  random: () => number = Math.random,
): string[] {
  const filtered = channelIds.filter((id) => id !== excludeId)

  if (filtered.length <= 1) {
    return [...filtered]
  }

  // Fisher-Yates shuffle on a copy
  const shuffled = [...filtered]

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]!
    shuffled[j] = temp!
  }

  return shuffled
}
