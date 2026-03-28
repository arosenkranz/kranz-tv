import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAllViewerCounts } from '~/hooks/use-all-viewer-counts'

describe('useAllViewerCounts', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty object initially', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ counts: {} }),
      }),
    )

    const { result } = renderHook(() => useAllViewerCounts())
    expect(result.current).toEqual({})
  })

  it('fetches counts on mount', async () => {
    const mockCounts = { skate: 5, music: 3 }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ counts: mockCounts }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAllViewerCounts())

    await waitFor(() => {
      expect(result.current).toEqual(mockCounts)
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/viewer-counts')
  })

  it('handles fetch errors gracefully', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAllViewerCounts())

    // Wait for the fetch to have been called
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    // Should still have empty counts, not throw
    expect(result.current).toEqual({})
  })

  it('handles non-ok responses gracefully', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAllViewerCounts())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    expect(result.current).toEqual({})
  })
})
