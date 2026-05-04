import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnboarding } from './use-onboarding'

describe('useOnboarding — mobile (default)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns needsOnboarding true on first visit', () => {
    const { result } = renderHook(() => useOnboarding())
    expect(result.current.needsOnboarding).toBe(true)
  })

  it('returns needsOnboarding false after dismissal', () => {
    const { result } = renderHook(() => useOnboarding())
    act(() => result.current.dismissOnboarding())
    expect(result.current.needsOnboarding).toBe(false)
  })

  it('persists dismissal to localStorage', () => {
    const { result } = renderHook(() => useOnboarding())
    act(() => result.current.dismissOnboarding())
    expect(localStorage.getItem('kranz-tv:mobile-onboarding-seen')).toBe('true')
  })

  it('returns needsOnboarding false when localStorage flag is set', () => {
    localStorage.setItem('kranz-tv:mobile-onboarding-seen', 'true')
    const { result } = renderHook(() => useOnboarding())
    expect(result.current.needsOnboarding).toBe(false)
  })
})

describe('useOnboarding — desktop', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns needsOnboarding true on first visit', () => {
    const { result } = renderHook(() => useOnboarding('desktop'))
    expect(result.current.needsOnboarding).toBe(true)
  })

  it('returns needsOnboarding false after dismissal', () => {
    const { result } = renderHook(() => useOnboarding('desktop'))
    act(() => result.current.dismissOnboarding())
    expect(result.current.needsOnboarding).toBe(false)
  })

  it('persists dismissal to correct localStorage key', () => {
    const { result } = renderHook(() => useOnboarding('desktop'))
    act(() => result.current.dismissOnboarding())
    expect(localStorage.getItem('kranz-tv:desktop-onboarding-seen')).toBe(
      'true',
    )
  })

  it('uses independent key from mobile', () => {
    localStorage.setItem('kranz-tv:mobile-onboarding-seen', 'true')
    const { result } = renderHook(() => useOnboarding('desktop'))
    expect(result.current.needsOnboarding).toBe(true)
  })
})
