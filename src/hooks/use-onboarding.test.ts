import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
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

describe('useOnboarding — hydration safety (#86)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('yields needsOnboarding=false on the server render (no localStorage read in initial render)', () => {
    // renderToString runs NO effects, so this is the server/first-client pass.
    // Even on a "first visit" (no flag set) it must be false, so SSR and the
    // first client render agree and no modal mounts during hydration (#86).
    // Before the fix the useState initializer read localStorage during render
    // and yielded true here, diverging from a returning client.
    function Probe(): string {
      const { needsOnboarding } = useOnboarding('desktop')
      return needsOnboarding ? 'SHOW' : 'HIDE'
    }
    const html = renderToString(createElement(Probe))
    expect(html).toBe('HIDE')
  })
})
