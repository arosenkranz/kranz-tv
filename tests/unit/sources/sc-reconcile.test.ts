import { describe, it, expect } from 'vitest'
import {
  decideReconcile,
  DRIFT_TOLERANCE_SECONDS,
  LOAD_GRACE_MS,
  SEEK_SETTLE_MS,
  MAX_LOAD_RETRIES,
} from '~/lib/sources/soundcloud/reconcile'
import type { ReconcileInput } from '~/lib/sources/soundcloud/reconcile'

const TRACK_A = 'https://w.soundcloud.com/player/?url=track-a'
const TRACK_B = 'https://w.soundcloud.com/player/?url=track-b'

function input(overrides: Partial<ReconcileInput> = {}): ReconcileInput {
  return {
    scheduledTrackUrl: TRACK_A,
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
