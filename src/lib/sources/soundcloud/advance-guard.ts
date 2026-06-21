// Shared budget for auto-advance (on finish and on error). Prevents runaway
// loadTrack loops when a cached playlist has zero/near-zero-duration entries
// (finish fires instantly) or many dead tracks (error fires repeatedly).
export interface AdvanceState {
  attempts: number
  lastAdvanceMs: number
}

// 1.5s catches the zero/near-zero-duration runaway, where finish fires in an
// instant loop (<100ms apart). Real tracks finish minutes apart, so this rung
// never blocks legitimate playback.
export const MIN_ADVANCE_INTERVAL_MS = 1500

// Full guard for the ERROR path: a channel of all-dead/geo-blocked tracks
// should stop cycling once we've tried every one (trackCount bound), and the
// time-rung prevents a tight error loop.
export function canAdvance(
  state: AdvanceState,
  trackCount: number,
  nowMs: number,
): boolean {
  if (trackCount <= 0) return false
  if (state.attempts >= trackCount) return false
  if (nowMs - state.lastAdvanceMs < MIN_ADVANCE_INTERVAL_MS) return false
  return true
}

// Finish is the happy path; bound ONLY by the rapid-loop interval, NOT by
// trackCount. A long session legitimately finishes many tracks — applying the
// trackCount bound here would strand a continuously-playing channel on one
// track after N natural finishes.
export function canAdvanceOnFinish(state: AdvanceState, nowMs: number): boolean {
  return nowMs - state.lastAdvanceMs >= MIN_ADVANCE_INTERVAL_MS
}

export function recordAdvance(state: AdvanceState, nowMs: number): AdvanceState {
  return { attempts: state.attempts + 1, lastAdvanceMs: nowMs }
}
