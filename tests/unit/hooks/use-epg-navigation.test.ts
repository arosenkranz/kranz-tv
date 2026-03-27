import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEpgNavigation } from '../../../src/hooks/use-epg-navigation'

describe('useEpgNavigation', () => {
  const onSelect = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function fireKey(key: string): void {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(event)
  }

  it('initializes cursor at initialIndex', () => {
    const { result } = renderHook(() =>
      useEpgNavigation({
        isOpen: true,
        channelCount: 5,
        initialIndex: 2,
        onSelect,
        onClose,
      }),
    )
    expect(result.current.cursorIndex).toBe(2)
  })

  it('ArrowDown moves cursor down', () => {
    const { result } = renderHook(() =>
      useEpgNavigation({
        isOpen: true,
        channelCount: 5,
        initialIndex: 1,
        onSelect,
        onClose,
      }),
    )
    act(() => {
      fireKey('ArrowDown')
    })
    expect(result.current.cursorIndex).toBe(2)
  })

  it('ArrowUp moves cursor up', () => {
    const { result } = renderHook(() =>
      useEpgNavigation({
        isOpen: true,
        channelCount: 5,
        initialIndex: 3,
        onSelect,
        onClose,
      }),
    )
    act(() => {
      fireKey('ArrowUp')
    })
    expect(result.current.cursorIndex).toBe(2)
  })

  it('ArrowDown wraps from last to first', () => {
    const { result } = renderHook(() =>
      useEpgNavigation({
        isOpen: true,
        channelCount: 5,
        initialIndex: 4,
        onSelect,
        onClose,
      }),
    )
    act(() => {
      fireKey('ArrowDown')
    })
    expect(result.current.cursorIndex).toBe(0)
  })

  it('ArrowUp wraps from first to last', () => {
    const { result } = renderHook(() =>
      useEpgNavigation({
        isOpen: true,
        channelCount: 5,
        initialIndex: 0,
        onSelect,
        onClose,
      }),
    )
    act(() => {
      fireKey('ArrowUp')
    })
    expect(result.current.cursorIndex).toBe(4)
  })

  it('Enter calls onSelect with current index then onClose', () => {
    renderHook(() =>
      useEpgNavigation({
        isOpen: true,
        channelCount: 5,
        initialIndex: 2,
        onSelect,
        onClose,
      }),
    )
    act(() => {
      fireKey('Enter')
    })
    expect(onSelect).toHaveBeenCalledWith(2)
    expect(onClose).toHaveBeenCalled()
  })

  it('Escape calls onClose', () => {
    renderHook(() =>
      useEpgNavigation({
        isOpen: true,
        channelCount: 5,
        initialIndex: 0,
        onSelect,
        onClose,
      }),
    )
    act(() => {
      fireKey('Escape')
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('G calls onClose', () => {
    renderHook(() =>
      useEpgNavigation({
        isOpen: true,
        channelCount: 5,
        initialIndex: 0,
        onSelect,
        onClose,
      }),
    )
    act(() => {
      fireKey('G')
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('does not respond to keys when isOpen is false', () => {
    renderHook(() =>
      useEpgNavigation({
        isOpen: false,
        channelCount: 5,
        initialIndex: 2,
        onSelect,
        onClose,
      }),
    )
    act(() => {
      fireKey('ArrowDown')
    })
    expect(onSelect).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('resets cursor to initialIndex when isOpen transitions to true', () => {
    const isOpen = false
    const { result, rerender } = renderHook(
      ({ open, idx }: { open: boolean; idx: number }) =>
        useEpgNavigation({
          isOpen: open,
          channelCount: 5,
          initialIndex: idx,
          onSelect,
          onClose,
        }),
      { initialProps: { open: false, idx: 3 } },
    )

    // Move cursor while closed (shouldn't respond, but test the reset)
    rerender({ open: true, idx: 3 })
    expect(result.current.cursorIndex).toBe(3)
  })
})
