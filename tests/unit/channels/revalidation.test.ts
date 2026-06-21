import { describe, it, expect } from 'vitest'
import { shouldApplyImmediately } from '~/lib/channels/revalidation'

const stub = { kind: 'music', id: 'a', tracks: [] } as any
const real = { kind: 'music', id: 'a', tracks: [{ id: '1' }] } as any
const fresh = { kind: 'music', id: 'a', tracks: [{ id: '2' }] } as any

describe('shouldApplyImmediately', () => {
  it('stages (false) when channel is active and already has real data', () => {
    expect(shouldApplyImmediately(fresh, real, 'a')).toBe(false)
  })
  it('applies (true) when channel is active but only has a stub', () => {
    expect(shouldApplyImmediately(fresh, stub, 'a')).toBe(true)
  })
  it('applies (true) when channel is not the active one', () => {
    expect(shouldApplyImmediately(fresh, real, 'b')).toBe(true)
  })
  it('applies (true) when there is no existing entry', () => {
    expect(shouldApplyImmediately(fresh, undefined, 'a')).toBe(true)
  })
})
