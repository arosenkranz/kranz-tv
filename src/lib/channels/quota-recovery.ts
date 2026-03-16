/**
 * Returns the UTC timestamp (ms) of the most recent midnight Pacific Time.
 * Used to determine whether a stored quota-exhausted timestamp predates the
 * last YouTube quota reset.
 */
export function getLastMidnightPTMs(now: Date = new Date()): number {
  const ptOffsetMinutes = getPTOffsetMinutes(now)
  const nowInPTMs = now.getTime() - ptOffsetMinutes * 60 * 1_000
  const startOfTodayPTMs = Math.floor(nowInPTMs / (24 * 60 * 60 * 1_000)) * (24 * 60 * 60 * 1_000)
  return startOfTodayPTMs + ptOffsetMinutes * 60 * 1_000
}

/**
 * Returns true if the stored quota-exhausted timestamp is from before the
 * last midnight PT reset, meaning the quota has likely been restored.
 */
export function isQuotaTimestampStale(storedTimestampMs: number, now: Date = new Date()): boolean {
  return storedTimestampMs < getLastMidnightPTMs(now)
}

/**
 * Returns the number of milliseconds until midnight Pacific Time.
 *
 * YouTube Data API quotas reset at midnight PT daily. This pure function is
 * safe to call on any client/server and is deterministic for a given `now`.
 * Handles DST automatically (PST = UTC-8, PDT = UTC-7).
 */
export function getMillisUntilMidnightPT(now: Date = new Date()): number {
  // Determine the current PT offset in minutes (positive = behind UTC)
  const ptOffsetMinutes = getPTOffsetMinutes(now)

  // Convert the current UTC ms to "PT ms" by subtracting the offset
  const nowInPTMs = now.getTime() - ptOffsetMinutes * 60 * 1_000

  // Round down to the start of the current PT day
  const startOfTodayPTMs = Math.floor(nowInPTMs / (24 * 60 * 60 * 1_000)) * (24 * 60 * 60 * 1_000)

  // Next PT midnight = start of tomorrow in PT time
  const nextMidnightPTMs = startOfTodayPTMs + 24 * 60 * 60 * 1_000

  // Convert back to UTC ms
  const nextMidnightUTCMs = nextMidnightPTMs + ptOffsetMinutes * 60 * 1_000

  const msRemaining = nextMidnightUTCMs - now.getTime()

  // Safety guard: clamp to 1 second minimum in case of floating point edge cases
  return Math.max(msRemaining, 1_000)
}

/**
 * Returns the current UTC offset for Pacific Time in minutes (positive = behind UTC).
 * PST = 480 (UTC-8), PDT = 420 (UTC-7).
 */
function getPTOffsetMinutes(now: Date): number {
  // Format the same instant in both PT and UTC, then compute the difference
  const ptFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const ptParts = ptFormatter.formatToParts(now)
  const utcParts = utcFormatter.formatToParts(now)

  const ptHour = Number(ptParts.find((p) => p.type === 'hour')?.value ?? '0')
  const ptMin = Number(ptParts.find((p) => p.type === 'minute')?.value ?? '0')
  const utcHour = Number(utcParts.find((p) => p.type === 'hour')?.value ?? '0')
  const utcMin = Number(utcParts.find((p) => p.type === 'minute')?.value ?? '0')

  let offsetMinutes = (utcHour * 60 + utcMin) - (ptHour * 60 + ptMin)
  // Handle day boundary wrap (e.g. UTC 01:00, PT 17:00 the previous day → offset 8h but wrapped)
  if (offsetMinutes < 0) offsetMinutes += 24 * 60

  return offsetMinutes
}
