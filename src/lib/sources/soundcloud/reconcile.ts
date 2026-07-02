// Pure decision logic for the provider's ~1s schedule reconcile loop and for
// natural-finish advancement. Given a snapshot of widget truth vs. scheduler
// truth, decide whether to reload the scheduled track, seek within the
// confirmed track, or do nothing.
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
  /**
   * Track whose stream ended (finish/error) before its scheduled slot did.
   * Its remainder can't be played, so while it is still the scheduled track
   * the loop must stay dormant instead of reloading it — the wall-clock
   * schedule walks past it at slot end on its own.
   */
  exhaustedTrackUrl: string | null
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
  | { action: 'noop'; reason?: 'retries-exhausted' | 'exhausted' }
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
    exhaustedTrackUrl,
    scheduledSeekSeconds,
    isPlaying,
    confirmedTrackUrl,
    lastProgressSeconds,
    loadInFlight,
    msSinceLastSeek,
    nowMs,
  } = input

  // The scheduled track's stream is exhausted — every correction would target
  // a position the stream can't serve, triggering an instant-finish reload
  // loop. Stay dormant until the schedule moves to the next slot.
  if (exhaustedTrackUrl !== null && exhaustedTrackUrl === scheduledTrackUrl) {
    return { action: 'noop', reason: 'exhausted' }
  }

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

export interface FinishTarget {
  trackUrl: string
  seekSeconds: number
  /**
   * True when the finished track is still the scheduled one — its stream
   * ended before its slot did, so we advance to the next slot's track and
   * the caller must mark the finished URL exhausted (reconcile would
   * otherwise reload the unplayable remainder in a loop).
   */
  finishedEarly: boolean
}

export interface SchedulePositionLike {
  itemUrl: string
  seekSeconds: number
  slotEndMs: number
}

/**
 * Decide what to load when a track finishes naturally (or errors). finish
 * almost never coincides with the slot boundary: load latency puts audio a
 * few seconds behind the wall clock, so finish fires after the schedule has
 * already crossed into the next slot. Looking up "1s past the current slot's
 * end" (the old behavior) therefore skips a track on every normal transition —
 * and the reconcile loop then audibly corrects it (next song starts, then
 * jumps). The wall clock is the sole authority: play whatever is scheduled
 * NOW, at its live seek. Only when the scheduled slot is unplayable — it's
 * the track that just ended, or one already marked exhausted — do we advance
 * to the next slot instead.
 *
 * Takes a position lookup rather than a channel so it stays decoupled from
 * scheduling types; the provider adapts getSchedulePosition. The next-slot
 * probe steps 1s past the boundary, assuming slots are ≥ 1s (zero-duration
 * cache entries are already a guarded failure mode in the advance budget).
 */
export function decideFinishTarget(
  finishedTrackUrl: string | null,
  exhaustedTrackUrl: string | null,
  positionAt: (atMs: number) => SchedulePositionLike,
  nowMs: number,
): FinishTarget {
  const nowPos = positionAt(nowMs)

  // Common case: the wall clock is on a playable track — play it live.
  if (
    nowPos.itemUrl !== finishedTrackUrl &&
    nowPos.itemUrl !== exhaustedTrackUrl
  ) {
    return {
      trackUrl: nowPos.itemUrl,
      seekSeconds: nowPos.seekSeconds,
      finishedEarly: false,
    }
  }

  const nextPos = positionAt(nowPos.slotEndMs + 1000)

  // The next slot wraps back to the finished track — a single-track channel's
  // normal replay. This must NOT be flagged as an early finish: on a
  // single-track channel the scheduled track never changes, so an exhausted
  // marker set here would never clear and reconcile would be parked forever.
  if (nextPos.itemUrl === finishedTrackUrl) {
    return {
      trackUrl: nextPos.itemUrl,
      seekSeconds: nextPos.seekSeconds,
      finishedEarly: false,
    }
  }

  // The scheduled slot is unplayable; advance to the next slot. Flag the
  // early finish (so the caller parks reconcile on it) only when it was the
  // just-finished track that fell short — if we got here via an already
  // exhausted slot, the marker is set and must not move to another track.
  return {
    trackUrl: nextPos.itemUrl,
    seekSeconds: nextPos.seekSeconds,
    finishedEarly: nowPos.itemUrl === finishedTrackUrl,
  }
}
