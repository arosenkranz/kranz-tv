// Shared budget for auto-advance (on finish and on error). Prevents runaway
// loadTrack loops when a cached playlist has zero/near-zero-duration entries
// (finish fires instantly) or many dead tracks (error fires repeatedly).
export interface AdvanceState {
  attempts: number
  lastAdvanceMs: number
}

export const MIN_ADVANCE_INTERVAL_MS = 1500

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

export function recordAdvance(state: AdvanceState, nowMs: number): AdvanceState {
  return { attempts: state.attempts + 1, lastAdvanceMs: nowMs }
}
