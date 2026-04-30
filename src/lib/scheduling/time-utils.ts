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
 * Returns the number of whole hours elapsed since the Unix epoch (UTC).
 */
export function getHoursSinceEpoch(date: Date): number {
  return Math.floor(date.getTime() / 1000 / 3600)
}

/**
 * Returns a per-hour offset into the playlist so content rotates every hour.
 * Two large primes are combined:
 *   - 7919: daily component (~2h 11m per day shift)
 *   - 3607: hourly component (shifts starting position each hour)
 * Both are chosen for coprimality with virtually all real playlist lengths
 * (gcd(prime, n) = 1 for any n not divisible by the prime), ensuring every
 * position in the playlist is eventually reachable.
 */
export function getDailyRotationSeed(
  date: Date,
  totalDurationSeconds: number,
): number {
  const daily = (getDaysSinceEpoch(date) * 7919) % totalDurationSeconds
  const hourly = (getHoursSinceEpoch(date) * 3607) % totalDurationSeconds
  return (daily + hourly) % totalDurationSeconds
}
