// Pure decision logic for the provider's ~1s schedule reconcile loop.
// Given a snapshot of widget truth vs. scheduler truth, decide whether to
// reload the scheduled track, seek within the confirmed track, or do nothing.
//
// Widget truth vs. asked truth: `confirmedTrackUrl` is what the widget has
// actually emitted PLAY_PROGRESS for since the last load(); the provider's
// currentTrackUrlRef is only what we *asked* it to load. Reconciliation must
// compare the scheduler against confirmed state, never against intent.

/**
 * Drift tolerance for in-track seek correction. Must stay comfortably above
 * SEEK_SETTLE_MS plus worst-case load-to-first-progress latency, or the loop
 * chases the moving live position it can never catch — re-seeking toward a
 * target that advanced while the previous seek was still settling. 12s gives
 * ~7s of headroom over the 5s settle window (the old view corrector used 8s,
 * which left only 3s on a slow connection).
 */
export const DRIFT_TOLERANCE_SECONDS = 12

/** How long a load() may run unconfirmed before reconcile retries it. */
export const LOAD_GRACE_MS = 10_000

/** Quiet period after any seek so we don't re-judge drift mid-settle. */
export const SEEK_SETTLE_MS = 5_000

/** Same-URL load retries before giving up until the schedule moves on. */
export const MAX_LOAD_RETRIES = 2

export interface LoadInFlight {
  /** Track URL passed to load(), awaiting its first PLAY_PROGRESS. */
  url: string
  startedAtMs: number
  /** Consecutive load-timeout retries of this same URL. */
  retryCount: number
}

export interface ReconcileInput {
  /** Track the scheduler says should be playing right now. */
  scheduledTrackUrl: string
  /** Live seek position within that track, per the scheduler. */
  scheduledSeekSeconds: number
  /** Widget status === 'playing'. */
  isPlaying: boolean
  /** Track confirmed via PLAY_PROGRESS since the last load(), or null. */
  confirmedTrackUrl: string | null
  /** Position from the most recent PLAY_PROGRESS event, or null. */
  lastProgressSeconds: number | null
  /** Unconfirmed load() in progress, or null. */
  loadInFlight: LoadInFlight | null
  /** Milliseconds since the provider last issued a seekTo, or null if never. */
  msSinceLastSeek: number | null
  nowMs: number
}

export type ReconcileDecision =
  | { action: 'noop'; reason?: 'retries-exhausted' }
  | { action: 'seek'; driftSeconds: number }
  | { action: 'reload'; reason: 'track-mismatch' | 'load-timeout' }

/**
 * Decide how to reconcile the widget with the schedule. Ordering matters:
 *
 * 1. A load in flight within its grace window wins — never chase a load.
 *    This also absorbs the finish-handler advancing slightly before the
 *    wall-clock schedule crosses the slot boundary.
 * 2. A paused/blocked widget is never corrected: reloading or seeking it
 *    can't produce sound without a user activation, and a track that is
 *    actually playing on-schedule must never be torn down — both invariants
 *    fall out of gating every correction on isPlaying.
 * 3. Only then compare confirmed track vs scheduled track, then drift.
 */
export function decideReconcile(input: ReconcileInput): ReconcileDecision {
  const {
    scheduledTrackUrl,
    scheduledSeekSeconds,
    isPlaying,
    confirmedTrackUrl,
    lastProgressSeconds,
    loadInFlight,
    msSinceLastSeek,
    nowMs,
  } = input

  if (loadInFlight) {
    if (nowMs - loadInFlight.startedAtMs <= LOAD_GRACE_MS) {
      return { action: 'noop' }
    }
    // Same dead URL, retries spent: stop hammering it. The schedule is
    // wall-clock driven, so it will move past this track at slot end and
    // the URL mismatch below will trigger a fresh load.
    if (
      loadInFlight.url === scheduledTrackUrl &&
      loadInFlight.retryCount >= MAX_LOAD_RETRIES
    ) {
      return { action: 'noop', reason: 'retries-exhausted' }
    }
    return { action: 'reload', reason: 'load-timeout' }
  }

  if (!isPlaying) return { action: 'noop' }
  if (confirmedTrackUrl === null) return { action: 'noop' }

  if (confirmedTrackUrl !== scheduledTrackUrl) {
    return { action: 'reload', reason: 'track-mismatch' }
  }

  if (lastProgressSeconds === null) return { action: 'noop' }
  if (msSinceLastSeek !== null && msSinceLastSeek < SEEK_SETTLE_MS) {
    return { action: 'noop' }
  }

  const driftSeconds = Math.abs(lastProgressSeconds - scheduledSeekSeconds)
  if (driftSeconds > DRIFT_TOLERANCE_SECONDS) {
    return { action: 'seek', driftSeconds }
  }

  return { action: 'noop' }
}
