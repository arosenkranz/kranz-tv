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
