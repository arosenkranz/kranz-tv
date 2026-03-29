import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOrientation } from './use-orientation'

type MqlListener = (e: { matches: boolean }) => void

function mockMatchMedia(landscape: boolean): {
  trigger: (landscape: boolean) => void
} {
  let listener: MqlListener | null = null

  vi.spyOn(window, 'matchMedia').mockImplementation(
    () =>
      ({
        matches: landscape,
        media: '(orientation: landscape)',
        addEventListener: (_: string, fn: MqlListener) => {
          listener = fn
        },
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  )

  return {
    trigger: (newLandscape: boolean) => {
      // Update the mock return and fire listener
      vi.spyOn(window, 'matchMedia').mockImplementation(
        () =>
          ({
            matches: newLandscape,
            media: '(orientation: landscape)',
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as unknown as MediaQueryList,
      )
      listener?.({ matches: newLandscape })
    },
  }
}

describe('useOrientation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns portrait by default', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useOrientation())
    expect(result.current).toBe('portrait')
  })

  it('returns landscape when screen is landscape', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useOrientation())
    expect(result.current).toBe('landscape')
  })

  it('updates when orientation changes', () => {
    const { trigger } = mockMatchMedia(false)
    const { result } = renderHook(() => useOrientation())
    expect(result.current).toBe('portrait')

    act(() => trigger(true))
    expect(result.current).toBe('landscape')
  })
})
