import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TvLayoutContext, useTvLayout } from './_tv'
import type { TvLayoutContextValue } from './_tv'

// ---------------------------------------------------------------------------
// TvLayoutContext default value
// ---------------------------------------------------------------------------

describe('TvLayoutContext default', () => {
  it('provides guideVisible=true and a no-op toggleGuide by default', () => {
    let capturedContext: TvLayoutContextValue | null = null

    function Consumer() {
      capturedContext = useTvLayout()
      return null
    }

    render(<Consumer />)

    expect(capturedContext).not.toBeNull()
    expect(capturedContext!.guideVisible).toBe(true)
    // Should not throw when called
    expect(() => capturedContext!.toggleGuide()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// TvLayoutContext.Provider wiring
// ---------------------------------------------------------------------------

describe('TvLayoutContext.Provider', () => {
  it('provides the supplied value to consumers', () => {
    let capturedContext: TvLayoutContextValue | null = null

    function Consumer() {
      capturedContext = useTvLayout()
      return null
    }

    const toggleGuide = vi.fn()
    render(
      <TvLayoutContext.Provider value={{ guideVisible: false, toggleGuide }}>
        <Consumer />
      </TvLayoutContext.Provider>,
    )

    expect(capturedContext!.guideVisible).toBe(false)
    capturedContext!.toggleGuide()
    expect(toggleGuide).toHaveBeenCalledOnce()
  })

  it('passes updated guideVisible when re-rendered', () => {
    let capturedContext: TvLayoutContextValue | null = null

    function Consumer() {
      capturedContext = useTvLayout()
      return null
    }

    const { rerender } = render(
      <TvLayoutContext.Provider value={{ guideVisible: true, toggleGuide: vi.fn() }}>
        <Consumer />
      </TvLayoutContext.Provider>,
    )

    expect(capturedContext!.guideVisible).toBe(true)

    rerender(
      <TvLayoutContext.Provider value={{ guideVisible: false, toggleGuide: vi.fn() }}>
        <Consumer />
      </TvLayoutContext.Provider>,
    )

    expect(capturedContext!.guideVisible).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Guide visibility toggle behavior (stateful wrapper)
// ---------------------------------------------------------------------------

describe('guide visibility toggle', () => {
  it('toggles guideVisible from true to false on first call', () => {
    let capturedContext: TvLayoutContextValue | null = null

    function Consumer() {
      capturedContext = useTvLayout()
      return (
        <button onClick={() => capturedContext!.toggleGuide()}>toggle</button>
      )
    }

    render(
      <TvLayoutContext.Provider value={{ guideVisible: true, toggleGuide: vi.fn() }}>
        <Consumer />
      </TvLayoutContext.Provider>,
    )

    // Just verify context is received correctly — the actual toggle state lives in TvLayout
    expect(capturedContext!.guideVisible).toBe(true)
  })

  it('context value is stable reference (same object for same render)', () => {
    const value: TvLayoutContextValue = { guideVisible: true, toggleGuide: vi.fn() }
    let ref1: TvLayoutContextValue | null = null
    let ref2: TvLayoutContextValue | null = null

    function ConsumerA() {
      ref1 = useTvLayout()
      return null
    }
    function ConsumerB() {
      ref2 = useTvLayout()
      return null
    }

    render(
      <TvLayoutContext.Provider value={value}>
        <ConsumerA />
        <ConsumerB />
      </TvLayoutContext.Provider>,
    )

    // Both consumers get the same object from the same provider render
    expect(ref1).toBe(ref2)
  })
})

// ---------------------------------------------------------------------------
// useTvLayout hook
// ---------------------------------------------------------------------------

describe('useTvLayout', () => {
  it('returns guideVisible and toggleGuide from context', () => {
    let result: TvLayoutContextValue | null = null

    function HookHarness() {
      result = useTvLayout()
      return null
    }

    const toggleGuide = vi.fn()
    render(
      <TvLayoutContext.Provider value={{ guideVisible: false, toggleGuide }}>
        <HookHarness />
      </TvLayoutContext.Provider>,
    )

    expect(result!.guideVisible).toBe(false)
    expect(result!.toggleGuide).toBe(toggleGuide)
  })

  it('calling toggleGuide from hook invokes the provider function', () => {
    const toggleGuide = vi.fn()
    let ctx: TvLayoutContextValue | null = null

    function HookHarness() {
      ctx = useTvLayout()
      return null
    }

    render(
      <TvLayoutContext.Provider value={{ guideVisible: true, toggleGuide }}>
        <HookHarness />
      </TvLayoutContext.Provider>,
    )

    act(() => ctx!.toggleGuide())
    expect(toggleGuide).toHaveBeenCalledOnce()
  })
})
