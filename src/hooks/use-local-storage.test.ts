import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorage } from './use-local-storage'

describe('useLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the initialValue when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'))
    expect(result.current[0]).toBe('default')
  })

  it('reads an existing value from localStorage on mount', () => {
    window.localStorage.setItem('existing-key', JSON.stringify({ count: 5 }))
    const { result } = renderHook(() => useLocalStorage('existing-key', { count: 0 }))
    expect(result.current[0]).toEqual({ count: 5 })
  })

  it('updates state and persists to localStorage on setValue', () => {
    const { result } = renderHook(() => useLocalStorage('write-key', 0))

    act(() => {
      result.current[1](42)
    })

    expect(result.current[0]).toBe(42)
    expect(JSON.parse(window.localStorage.getItem('write-key') ?? 'null')).toBe(42)
  })

  it('works with array values', () => {
    const { result } = renderHook(() => useLocalStorage<string[]>('arr-key', []))

    act(() => {
      result.current[1](['a', 'b', 'c'])
    })

    expect(result.current[0]).toEqual(['a', 'b', 'c'])
    expect(JSON.parse(window.localStorage.getItem('arr-key') ?? '[]')).toEqual(['a', 'b', 'c'])
  })

  it('works with boolean values', () => {
    const { result } = renderHook(() => useLocalStorage('bool-key', false))

    act(() => {
      result.current[1](true)
    })

    expect(result.current[0]).toBe(true)
  })

  it('returns initialValue when localStorage contains malformed JSON', () => {
    window.localStorage.setItem('bad-json', 'not-valid-json{{{')
    const { result } = renderHook(() => useLocalStorage('bad-json', 'fallback'))
    expect(result.current[0]).toBe('fallback')
  })

  it('does not throw when localStorage.setItem throws (e.g. quota exceeded)', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    const { result } = renderHook(() => useLocalStorage('quota-key', 'initial'))

    expect(() => {
      act(() => {
        result.current[1]('new-value')
      })
    }).not.toThrow()

    // State was still updated in memory even if storage failed
    expect(result.current[0]).toBe('new-value')
  })

  it('overwrites a previously written value', () => {
    const { result } = renderHook(() => useLocalStorage('overwrite-key', 'first'))

    act(() => {
      result.current[1]('second')
    })

    act(() => {
      result.current[1]('third')
    })

    expect(result.current[0]).toBe('third')
    expect(JSON.parse(window.localStorage.getItem('overwrite-key') ?? '"none"')).toBe('third')
  })

  it('two hooks sharing the same key are independent state instances', () => {
    const { result: r1 } = renderHook(() => useLocalStorage('shared-key', 0))
    const { result: r2 } = renderHook(() => useLocalStorage('shared-key', 0))

    act(() => {
      r1.current[1](99)
    })

    // r1 updated, r2 has its own state snapshot
    expect(r1.current[0]).toBe(99)
    expect(r2.current[0]).toBe(0)
  })
})
