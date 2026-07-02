import { describe, it, expect } from 'vitest'
import {
  decideFinishTarget,
  decideReconcile,
  DRIFT_TOLERANCE_SECONDS,
  LOAD_GRACE_MS,
  SEEK_SETTLE_MS,
  MAX_LOAD_RETRIES,
} from '~/lib/sources/soundcloud/reconcile'
import type {
  ReconcileInput,
  SchedulePositionLike,
} from '~/lib/sources/soundcloud/reconcile'

const TRACK_A = 'https://w.soundcloud.com/player/?url=track-a'
const TRACK_B = 'https://w.soundcloud.com/player/?url=track-b'

function input(overrides: Partial<ReconcileInput> = {}): ReconcileInput {
  return {
    scheduledTrackUrl: TRACK_A,
    exhaustedTrackUrl: null,
    scheduledSeekSeconds: 120,
    isPlaying: true,
    confirmedTrackUrl: TRACK_A,
    lastProgressSeconds: 120,
    loadInFlight: null,
    msSinceLastSeek: null,
    nowMs: 100_000,
    ...overrides,
  }
}

describe('decideReconcile — load in flight', () => {
  it('noops while a load is within its grace window (never chase a load)', () => {
    const d = decideReconcile(
      input({
        loadInFlight: { url: TRACK_A, startedAtMs: 100_000 - 2_000, retryCount: 0 },
        confirmedTrackUrl: null,
      }),
    )
    expect(d).toEqual({ action: 'noop' })
  })

  it('noops within grace even when the in-flight url differs from schedule (finish advanced before slot boundary)', () => {
    const d = decideReconcile(
      input({
        scheduledTrackUrl: TRACK_A,
        loadInFlight: { url: TRACK_B, startedAtMs: 100_000 - 500, retryCount: 0 },
        confirmedTrackUrl: null,
      }),
    )
    expect(d).toEqual({ action: 'noop' })
  })

  it('reloads after grace expires (load-timeout)', () => {
    const d = decideReconcile(
      input({
        loadInFlight: {
          url: TRACK_A,
          startedAtMs: 100_000 - LOAD_GRACE_MS - 1,
          retryCount: 0,
        },
        confirmedTrackUrl: null,
      }),
    )
    expect(d).toEqual({ action: 'reload', reason: 'load-timeout' })
  })

  it('gives up on a same-url load once retries are exhausted', () => {
    const d = decideReconcile(
      input({
        loadInFlight: {
          url: TRACK_A,
          startedAtMs: 100_000 - LOAD_GRACE_MS - 1,
          retryCount: MAX_LOAD_RETRIES,
        },
        confirmedTrackUrl: null,
      }),
    )
    expect(d).toEqual({ action: 'noop', reason: 'retries-exhausted' })
  })

  it('still reloads after exhausted retries once the schedule moves to a new track', () => {
    const d = decideReconcile(
      input({
        scheduledTrackUrl: TRACK_B,
        loadInFlight: {
          url: TRACK_A,
          startedAtMs: 100_000 - LOAD_GRACE_MS - 1,
          retryCount: MAX_LOAD_RETRIES,
        },
        confirmedTrackUrl: null,
      }),
    )
    expect(d).toEqual({ action: 'reload', reason: 'load-timeout' })
  })
})

describe('decideReconcile — paused / unconfirmed widget', () => {
  it('never corrects a widget that is not playing', () => {
    const d = decideReconcile(
      input({ isPlaying: false, confirmedTrackUrl: TRACK_B }),
    )
    expect(d).toEqual({ action: 'noop' })
  })

  it('noops with no confirmed track and no load in flight', () => {
    const d = decideReconcile(
      input({ confirmedTrackUrl: null, lastProgressSeconds: null }),
    )
    expect(d).toEqual({ action: 'noop' })
  })
})

describe('decideReconcile — track mismatch', () => {
  it('reloads when the confirmed track differs from the schedule', () => {
    const d = decideReconcile(input({ confirmedTrackUrl: TRACK_B }))
    expect(d).toEqual({ action: 'reload', reason: 'track-mismatch' })
  })
})

describe('decideReconcile — drift within the confirmed track', () => {
  it('noops when drift is within tolerance (on-schedule track is never torn down)', () => {
    const d = decideReconcile(
      input({ lastProgressSeconds: 120 + DRIFT_TOLERANCE_SECONDS }),
    )
    expect(d).toEqual({ action: 'noop' })
  })

  it('seeks when drift exceeds tolerance', () => {
    const drift = DRIFT_TOLERANCE_SECONDS + 5
    const d = decideReconcile(input({ lastProgressSeconds: 120 + drift }))
    expect(d).toEqual({ action: 'seek', driftSeconds: drift })
  })

  it('seeks on negative drift too (widget behind schedule)', () => {
    const drift = DRIFT_TOLERANCE_SECONDS + 30
    const d = decideReconcile(input({ lastProgressSeconds: 120 - drift }))
    expect(d).toEqual({ action: 'seek', driftSeconds: drift })
  })

  it('does not re-judge drift while a recent seek is still settling', () => {
    const d = decideReconcile(
      input({
        lastProgressSeconds: 300,
        msSinceLastSeek: SEEK_SETTLE_MS - 1,
      }),
    )
    expect(d).toEqual({ action: 'noop' })
  })

  it('judges drift again once the settle window has passed', () => {
    const d = decideReconcile(
      input({
        lastProgressSeconds: 300,
        msSinceLastSeek: SEEK_SETTLE_MS,
      }),
    )
    expect(d).toEqual({ action: 'seek', driftSeconds: 180 })
  })

  it('noops when no progress has been observed yet', () => {
    const d = decideReconcile(input({ lastProgressSeconds: null }))
    expect(d).toEqual({ action: 'noop' })
  })
})

describe('decideReconcile — exhausted scheduled track', () => {
  it('stays dormant while the exhausted track is still scheduled, even on mismatch', () => {
    const d = decideReconcile(
      input({ exhaustedTrackUrl: TRACK_A, confirmedTrackUrl: TRACK_B }),
    )
    expect(d).toEqual({ action: 'noop', reason: 'exhausted' })
  })

  it('exhausted marker wins over an in-flight load for the same track', () => {
    const d = decideReconcile(
      input({
        exhaustedTrackUrl: TRACK_A,
        confirmedTrackUrl: null,
        loadInFlight: {
          url: TRACK_A,
          startedAtMs: 100_000 - LOAD_GRACE_MS - 1,
          retryCount: 0,
        },
      }),
    )
    expect(d).toEqual({ action: 'noop', reason: 'exhausted' })
  })

  it('resumes normal corrections once the schedule moves past the exhausted track', () => {
    const d = decideReconcile(
      input({
        scheduledTrackUrl: TRACK_B,
        exhaustedTrackUrl: TRACK_A,
        confirmedTrackUrl: TRACK_A,
      }),
    )
    expect(d).toEqual({ action: 'reload', reason: 'track-mismatch' })
  })
})

describe('decideFinishTarget', () => {
  // Schedule fixture: track A's slot [0, 300s), track B's [300s, 600s),
  // track C's [600s, 900s).
  const positionAt = (atMs: number): SchedulePositionLike => {
    const sec = atMs / 1000
    if (sec < 300) return { itemUrl: TRACK_A, seekSeconds: sec, slotEndMs: 300_000 }
    if (sec < 600)
      return { itemUrl: TRACK_B, seekSeconds: sec - 300, slotEndMs: 600_000 }
    return { itemUrl: 'track-c', seekSeconds: sec - 600, slotEndMs: 900_000 }
  }

  it('normal transition: finish just past the boundary plays the now-scheduled track near its start', () => {
    // A finishes 4s after its slot ended (load latency lag).
    const t = decideFinishTarget(TRACK_A, null, positionAt, 304_000)
    expect(t).toEqual({ trackUrl: TRACK_B, seekSeconds: 4, finishedEarly: false })
  })

  it('late finish: plays the scheduled track at its live seek instead of skipping it', () => {
    // A's audio ran 40s past its slot; schedule is 40s into B. The old
    // slot-end+1s lookup would have skipped to C.
    const t = decideFinishTarget(TRACK_A, null, positionAt, 340_000)
    expect(t).toEqual({ trackUrl: TRACK_B, seekSeconds: 40, finishedEarly: false })
  })

  it('early finish: stream ended mid-slot — advances to the next slot and flags exhaustion', () => {
    // A's stream ended 100s before its slot does.
    const t = decideFinishTarget(TRACK_A, null, positionAt, 200_000)
    expect(t).toEqual({ trackUrl: TRACK_B, seekSeconds: 1, finishedEarly: true })
  })
})

describe('decideFinishTarget — exhausted and single-track cases', () => {
  const positionAt = (atMs: number): SchedulePositionLike => {
    const sec = atMs / 1000
    if (sec < 300) return { itemUrl: TRACK_A, seekSeconds: sec, slotEndMs: 300_000 }
    if (sec < 600)
      return { itemUrl: TRACK_B, seekSeconds: sec - 300, slotEndMs: 600_000 }
    return { itemUrl: 'track-c', seekSeconds: sec - 600, slotEndMs: 900_000 }
  }

  it('never targets the exhausted scheduled track (error on the advanced track)', () => {
    // A exhausted, B (the advanced track) errored while A is still scheduled.
    // Must NOT return A — returning B lets the caller's same-track guard
    // suppress the reload instead of thrash-looping A.
    const t = decideFinishTarget(TRACK_B, TRACK_A, positionAt, 200_000)
    expect(t.trackUrl).not.toBe(TRACK_A)
    expect(t).toEqual({ trackUrl: TRACK_B, seekSeconds: 1, finishedEarly: false })
  })

  it('does not move the exhausted flag when skipping an exhausted slot', () => {
    // Finished C (played during A's exhausted slot... schedule window makes
    // next after A = B, which differs from finished C) — advance without
    // flagging B or C early.
    const t = decideFinishTarget('track-c', TRACK_A, positionAt, 200_000)
    expect(t).toEqual({ trackUrl: TRACK_B, seekSeconds: 1, finishedEarly: false })
  })

  it('single-track channel wrap is a normal replay, never an early finish', () => {
    // One-track channel: schedule always returns the same URL.
    const singleTrackAt = (atMs: number): SchedulePositionLike => {
      const cycle = 300_000
      const inCycle = atMs % cycle
      return {
        itemUrl: TRACK_A,
        seekSeconds: inCycle / 1000,
        slotEndMs: atMs - inCycle + cycle,
      }
    }
    const t = decideFinishTarget(TRACK_A, null, singleTrackAt, 299_500)
    expect(t.finishedEarly).toBe(false)
    expect(t.trackUrl).toBe(TRACK_A)
  })
})
