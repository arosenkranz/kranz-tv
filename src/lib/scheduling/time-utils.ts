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
 * The factor 127 is a prime chosen to distribute offsets across a typical
 * playlist length without quick repetition.
 */
export function getDailyRotationSeed(
  date: Date,
  totalDurationSeconds: number,
): number {
  return (getDaysSinceEpoch(date) * 127) % totalDurationSeconds
}
