import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFullscreen } from '~/hooks/use-fullscreen'

// jsdom does not implement the Fullscreen API, so toggle paths are driven by
// explicitly installing/removing the (including webkit-prefixed) properties.
function setDocumentProp(name: string, value: unknown): void {
  Object.defineProperty(document, name, {
    value,
    configurable: true,
    writable: true,
  })
}

function setElementProp(el: Element, name: string, value: unknown): void {
  Object.defineProperty(el, name, { value, configurable: true, writable: true })
}

function clearFullscreenApi(): void {
  setDocumentProp('fullscreenElement', null)
  setDocumentProp('webkitFullscreenElement', null)
  setDocumentProp('exitFullscreen', undefined)
  setDocumentProp('webkitExitFullscreen', undefined)
  const el = document.documentElement
  setElementProp(el, 'requestFullscreen', undefined)
  setElementProp(el, 'webkitRequestFullscreen', undefined)
}

beforeEach(() => {
  clearFullscreenApi()
})

afterEach(() => {
  clearFullscreenApi()
})

describe('useFullscreen', () => {
  it('starts not fullscreen and reacts to native fullscreenchange events', () => {
    const { result } = renderHook(() => useFullscreen())

    expect(result.current.isFullscreen).toBe(false)

    // Enter native fullscreen out-of-band (e.g. browser chrome)
    act(() => {
      setDocumentProp('fullscreenElement', document.documentElement)
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(result.current.isFullscreen).toBe(true)

    act(() => {
      setDocumentProp('fullscreenElement', null)
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(result.current.isFullscreen).toBe(false)
  })

  it('reports fullscreen from the webkit-prefixed element alone', () => {
    const { result } = renderHook(() => useFullscreen())

    act(() => {
      setDocumentProp('webkitFullscreenElement', document.documentElement)
      document.dispatchEvent(new Event('webkitfullscreenchange'))
    })
    expect(result.current.isFullscreen).toBe(true)

    act(() => {
      setDocumentProp('webkitFullscreenElement', null)
      document.dispatchEvent(new Event('webkitfullscreenchange'))
    })
    expect(result.current.isFullscreen).toBe(false)
  })

  it('exits native fullscreen via exitFullscreen', () => {
    const mockExit = vi.fn().mockResolvedValue(undefined)
    setDocumentProp('fullscreenElement', document.documentElement)
    setDocumentProp('exitFullscreen', mockExit)

    const { result } = renderHook(() => useFullscreen())
    act(() => {
      result.current.toggleFullscreen()
    })

    expect(mockExit).toHaveBeenCalledOnce()
    expect(mockExit).toHaveBeenCalledWith()
  })

  it('falls back to webkitExitFullscreen when exitFullscreen rejects', async () => {
    const mockExit = vi.fn().mockRejectedValue(new Error('not allowed'))
    const mockWebkitExit = vi.fn().mockResolvedValue(undefined)
    setDocumentProp('fullscreenElement', document.documentElement)
    setDocumentProp('exitFullscreen', mockExit)
    setDocumentProp('webkitExitFullscreen', mockWebkitExit)

    const { result } = renderHook(() => useFullscreen())
    await act(async () => {
      result.current.toggleFullscreen()
    })

    await waitFor(() => expect(mockWebkitExit).toHaveBeenCalledOnce())
  })

  it('exits pseudo-fullscreen when toggled a second time', () => {
    // No native API at all (iPhone Safari) — enter, then exit
    const { result } = renderHook(() => useFullscreen())

    act(() => {
      result.current.toggleFullscreen()
    })
    expect(result.current.isFullscreen).toBe(true)

    act(() => {
      result.current.toggleFullscreen()
    })
    expect(result.current.isFullscreen).toBe(false)
  })

  it('enters native fullscreen when requestFullscreen resolves', async () => {
    const mockRequest = vi.fn().mockResolvedValue(undefined)
    setElementProp(document.documentElement, 'requestFullscreen', mockRequest)

    const { result } = renderHook(() => useFullscreen())
    act(() => {
      result.current.toggleFullscreen()
    })

    expect(mockRequest).toHaveBeenCalledOnce()
    // The native request resolved, so no pseudo-fallback state was set
    expect(result.current.isFullscreen).toBe(false)
  })

  it('falls back to pseudo-fullscreen when the native request rejects (iPadOS)', async () => {
    const mockRequest = vi.fn().mockRejectedValue(new Error('rejected'))
    setElementProp(document.documentElement, 'requestFullscreen', mockRequest)

    const { result } = renderHook(() => useFullscreen())
    act(() => {
      result.current.toggleFullscreen()
    })

    await waitFor(() => expect(result.current.isFullscreen).toBe(true))
  })

  it('uses the webkit-prefixed request when requestFullscreen is missing', async () => {
    const mockWebkitRequest = vi.fn().mockResolvedValue(undefined)
    setElementProp(
      document.documentElement,
      'webkitRequestFullscreen',
      mockWebkitRequest,
    )

    const { result } = renderHook(() => useFullscreen())
    act(() => {
      result.current.toggleFullscreen()
    })

    expect(mockWebkitRequest).toHaveBeenCalledOnce()
    expect(result.current.isFullscreen).toBe(false)
  })
})
