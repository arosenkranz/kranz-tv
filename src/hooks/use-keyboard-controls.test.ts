import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardControls } from './use-keyboard-controls'
import type { KeyboardControlsConfig } from './use-keyboard-controls'

function makeConfig(
  overrides: Partial<KeyboardControlsConfig> = {},
): KeyboardControlsConfig {
  return {
    onChannelUp: vi.fn(),
    onChannelDown: vi.fn(),
    onToggleGuide: vi.fn(),
    onToggleMute: vi.fn(),
    onImport: vi.fn(),
    onInfo: vi.fn(),
    onHelp: vi.fn(),
    onEscape: vi.fn(),
    onHome: vi.fn(),
    onFullscreen: vi.fn(),
    onOverlay: vi.fn(),
    ...overrides,
  }
}

function fireKey(key: string, target?: EventTarget) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true })
  if (target) {
    Object.defineProperty(event, 'target', {
      value: target,
      configurable: true,
    })
  }
  window.dispatchEvent(event)
}

describe('useKeyboardControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls onChannelUp on ArrowUp', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))
    fireKey('ArrowUp')
    expect(config.onChannelUp).toHaveBeenCalledOnce()
  })

  it('calls onChannelDown on ArrowDown', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))
    fireKey('ArrowDown')
    expect(config.onChannelDown).toHaveBeenCalledOnce()
  })

  it('calls onToggleGuide on g', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))
    fireKey('g')
    expect(config.onToggleGuide).toHaveBeenCalledOnce()
  })

  it('calls onToggleGuide on G', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))
    fireKey('G')
    expect(config.onToggleGuide).toHaveBeenCalledOnce()
  })

  it('calls onToggleMute on m', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))
    fireKey('m')
    expect(config.onToggleMute).toHaveBeenCalledOnce()
  })

  it('calls onToggleMute on M', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))
    fireKey('M')
    expect(config.onToggleMute).toHaveBeenCalledOnce()
  })

  it('calls onImport on i', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))
    fireKey('i')
    expect(config.onImport).toHaveBeenCalledOnce()
  })

  it('calls onImport on I', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))
    fireKey('I')
    expect(config.onImport).toHaveBeenCalledOnce()
  })

  it('calls onInfo on n', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))
    fireKey('n')
    expect(config.onInfo).toHaveBeenCalledOnce()
  })

  it('calls onInfo on N', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))
    fireKey('N')
    expect(config.onInfo).toHaveBeenCalledOnce()
  })

  it('calls onHelp on ?', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))
    fireKey('?')
    expect(config.onHelp).toHaveBeenCalledOnce()
  })

  it('calls onEscape on Escape', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))
    fireKey('Escape')
    expect(config.onEscape).toHaveBeenCalledOnce()
  })

  it('does not call any handler for unbound keys', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))
    fireKey('a')
    fireKey('Enter')
    fireKey('Tab')
    Object.values(config).forEach((fn) => expect(fn).not.toHaveBeenCalled())
  })

  it('removes the event listener on unmount', () => {
    const config = makeConfig()
    const { unmount } = renderHook(() => useKeyboardControls(config))
    unmount()
    fireKey('ArrowUp')
    expect(config.onChannelUp).not.toHaveBeenCalled()
  })

  it('ignores keys fired from an INPUT element', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))

    const input = document.createElement('input')
    document.body.appendChild(input)
    try {
      // Dispatch directly from the input — simulate typing
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
      })
      input.dispatchEvent(event)
      // The window listener gets a bubbled event with target = input
      // Our guard checks event.target.tagName
    } finally {
      document.body.removeChild(input)
    }
    // Since bubbled events to window have the original target set by the browser,
    // we verify the guard branches exist via a direct dispatch with a mocked target
    const guardedEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' })
    const fakeInput = document.createElement('input')
    Object.defineProperty(guardedEvent, 'target', {
      value: fakeInput,
      configurable: true,
    })
    window.dispatchEvent(guardedEvent)
    expect(config.onChannelUp).not.toHaveBeenCalled()
  })

  it('ignores keys fired from a TEXTAREA element', () => {
    const config = makeConfig()
    renderHook(() => useKeyboardControls(config))
    const guardedEvent = new KeyboardEvent('keydown', { key: 'g' })
    const fakeTextarea = document.createElement('textarea')
    Object.defineProperty(guardedEvent, 'target', {
      value: fakeTextarea,
      configurable: true,
    })
    window.dispatchEvent(guardedEvent)
    expect(config.onToggleGuide).not.toHaveBeenCalled()
  })

  it('re-registers the listener when a callback reference changes', () => {
    const config1 = makeConfig()
    const config2 = makeConfig()

    const { rerender } = renderHook(
      ({ cfg }: { cfg: KeyboardControlsConfig }) => useKeyboardControls(cfg),
      { initialProps: { cfg: config1 } },
    )

    rerender({ cfg: config2 })
    fireKey('ArrowUp')

    expect(config1.onChannelUp).not.toHaveBeenCalled()
    expect(config2.onChannelUp).toHaveBeenCalledOnce()
  })

  it('calls onKeyMatched with normalized key after a match', () => {
    const onKeyMatched = vi.fn()
    const config = makeConfig({ onKeyMatched })
    renderHook(() => useKeyboardControls(config))

    fireKey('G')
    expect(onKeyMatched).toHaveBeenCalledWith('g')

    fireKey('ArrowUp')
    expect(onKeyMatched).toHaveBeenCalledWith('ArrowUp')

    fireKey('?')
    expect(onKeyMatched).toHaveBeenCalledWith('?')

    expect(onKeyMatched).toHaveBeenCalledTimes(3)
  })

  it('does not call onKeyMatched for unrecognized keys', () => {
    const onKeyMatched = vi.fn()
    const config = makeConfig({ onKeyMatched })
    renderHook(() => useKeyboardControls(config))
    fireKey('z')
    expect(onKeyMatched).not.toHaveBeenCalled()
  })

  it('works without onKeyMatched (backward compatible)', () => {
    const config = makeConfig() // no onKeyMatched
    const { unmount } = renderHook(() => useKeyboardControls(config))
    fireKey('G')
    expect(config.onToggleGuide).toHaveBeenCalledOnce()
    unmount()
  })
})
