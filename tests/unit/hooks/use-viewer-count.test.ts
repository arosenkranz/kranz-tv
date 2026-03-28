import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useViewerCount } from '~/hooks/use-viewer-count'

// Mock the RUM tracker
vi.mock('~/lib/datadog/rum', () => ({
  trackViewerCount: vi.fn(),
}))

// Mock WebSocket with proper OPEN constant matching the global
class MockWebSocket {
  static instances: MockWebSocket[] = []

  readyState = 0 // CONNECTING
  url: string
  listeners: Record<string, Array<(event: unknown) => void>> = {}
  sentMessages: string[] = []

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
    // Auto-fire open on next microtask
    queueMicrotask(() => {
      this.readyState = 1 // OPEN
      this.fireEvent('open', {})
    })
  }

  addEventListener(event: string, handler: (event: unknown) => void) {
    this.listeners[event] ??= []
    this.listeners[event].push(handler)
  }

  send(data: string) {
    this.sentMessages.push(data)
  }

  close() {
    this.readyState = 3 // CLOSED
    this.fireEvent('close', {})
  }

  // Test helpers
  fireEvent(event: string, data: unknown) {
    for (const handler of this.listeners[event] ?? []) {
      handler(data)
    }
  }

  simulateMessage(data: unknown) {
    this.fireEvent('message', { data: JSON.stringify(data) })
  }
}

// Set the constants on the class to match real WebSocket
Object.defineProperty(MockWebSocket, 'OPEN', { value: 1 })
Object.defineProperty(MockWebSocket, 'CLOSED', { value: 3 })

describe('useViewerCount', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null count and disconnected when no channelId', () => {
    const { result } = renderHook(() => useViewerCount(null))
    expect(result.current.count).toBeNull()
    expect(result.current.isConnected).toBe(false)
  })

  it('connects to WebSocket with channel parameter', async () => {
    renderHook(() => useViewerCount('skate'))

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1)
    })

    expect(MockWebSocket.instances[0].url).toContain('_ws?channel=skate')
  })

  it('updates count when receiving viewer_count message', async () => {
    const { result } = renderHook(() => useViewerCount('skate'))

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1)
    })

    const ws = MockWebSocket.instances[0]

    // Wait for open event
    await vi.waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    act(() => {
      ws.simulateMessage({ type: 'viewer_count', channel: 'skate', count: 5 })
    })

    expect(result.current.count).toBe(5)
  })

  it('creates new WebSocket when channelId changes', async () => {
    const { result, rerender } = renderHook(
      ({ channelId }: { channelId: string }) => useViewerCount(channelId),
      { initialProps: { channelId: 'skate' } },
    )

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1)
    })

    // Wait for WebSocket to be fully open
    await vi.waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    rerender({ channelId: 'music' })

    // Old socket closed, new one created for new channel
    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(2)
    })

    expect(MockWebSocket.instances[0].readyState).toBe(3) // CLOSED
    expect(MockWebSocket.instances[1].url).toContain('_ws?channel=music')
  })

  it('ignores non-viewer_count messages', async () => {
    const { result } = renderHook(() => useViewerCount('skate'))

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1)
    })

    const ws = MockWebSocket.instances[0]

    act(() => {
      ws.simulateMessage({ type: 'pong' })
    })

    expect(result.current.count).toBeNull()
  })

  it('resets count to null when channelId becomes null', async () => {
    const { result, rerender } = renderHook(
      ({ channelId }: { channelId: string | null }) =>
        useViewerCount(channelId),
      { initialProps: { channelId: 'skate' as string | null } },
    )

    await vi.waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1)
    })

    const ws = MockWebSocket.instances[0]

    // Wait for open
    await vi.waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    act(() => {
      ws.simulateMessage({ type: 'viewer_count', channel: 'skate', count: 3 })
    })

    expect(result.current.count).toBe(3)

    rerender({ channelId: null })

    expect(result.current.count).toBeNull()
  })
})
