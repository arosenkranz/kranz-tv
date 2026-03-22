/**
 * Returns the number of whole seconds elapsed since UTC midnight of the given date.
 */
export function getSecondsSinceMidnightUTC(date: Date): number {
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes()
  const seconds = date.getUTCSeconds()
  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Returns the number of full days elapsed since the Unix epoch (1970-01-01 UTC).
 * Uses floor so the result is always a non-negative integer.
 */
export function getDaysSinceEpoch(date: Date): number {
  return Math.floor(date.getTime() / 1000 / 86400)
}

/**
 * Converts a string to a stable 32-bit integer seed via djb2 XOR hashing.
 * Produces well-distributed values for short strings like channel IDs.
 */
export function stringToSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0
  }
  return hash >>> 0 // coerce to unsigned 32-bit
}

/**
 * Returns a seeded pseudo-random number generator using the mulberry32 algorithm.
 * Pure function — returns a new RNG function each call; no shared state.
 */
function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

/**
 * Returns a new array with elements shuffled using a seeded Fisher-Yates shuffle.
 * Deterministic for a given seed — same seed always produces the same order.
 * Does not mutate the input array.
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items]
  const rng = mulberry32(seed)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Returns a per-day offset into the playlist so the content rotates daily.
 * The factor 7919 is a large prime (~2h 11m daily shift) chosen so that:
 *   - All positions in long playlists are reachable within days, not months.
 *   - Coprimality is preserved (gcd(7919, n) = 1 for virtually all real playlist
 *     lengths), so every offset position is eventually visited.
 * A percentage-based step was rejected because it produces composite values for
 * most playlist lengths, creating permanent blind spots via gcd > 1.
 */
export function getDailyRotationSeed(
  date: Date,
  totalDurationSeconds: number,
): number {
  return (getDaysSinceEpoch(date) * 7919) % totalDurationSeconds
}
