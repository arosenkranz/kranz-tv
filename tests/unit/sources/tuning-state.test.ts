import { describe, it, expect } from 'vitest'
import { tuningPhase } from '~/lib/sources/soundcloud/tuning-state'
import type { TuningPhase } from '~/lib/sources/soundcloud/tuning-state'

describe('tuningPhase', () => {
  it('resolving when channel not yet active', () => {
    expect(tuningPhase({ isActiveChannel: false, status: 'mounting' }))
      .toEqual<TuningPhase>({ phase: 'resolving', label: 'RESOLVING SIGNAL…', showStatic: true })
  })
  it('locking when active but still mounting', () => {
    expect(tuningPhase({ isActiveChannel: true, status: 'mounting' }))
      .toEqual<TuningPhase>({ phase: 'locking', label: 'LOCKING AUDIO…', showStatic: true })
  })
  it('playing clears the overlay', () => {
    expect(tuningPhase({ isActiveChannel: true, status: 'playing' }))
      .toEqual<TuningPhase>({ phase: 'playing', label: '', showStatic: false })
  })
  it('ready (about to play) clears the overlay', () => {
    expect(tuningPhase({ isActiveChannel: true, status: 'ready' }))
      .toEqual<TuningPhase>({ phase: 'playing', label: '', showStatic: false })
  })
  it('error shows NO SIGNAL', () => {
    expect(tuningPhase({ isActiveChannel: true, status: 'error' }))
      .toEqual<TuningPhase>({ phase: 'error', label: 'NO SIGNAL', showStatic: true })
  })
})
