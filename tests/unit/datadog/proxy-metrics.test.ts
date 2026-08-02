import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withProxyMetrics } from '~/lib/datadog/proxy-metrics'
import {
  flushMetrics,
  incrementMetric,
  recordDistribution,
} from '~/lib/datadog/worker-metrics'

vi.mock('~/lib/datadog/worker-metrics', () => ({
  incrementMetric: vi.fn(),
  recordDistribution: vi.fn(),
  flushMetrics: vi.fn().mockResolvedValue(undefined),
}))

describe('withProxyMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the handler result and emits status:ok', async () => {
    const result = await withProxyMetrics('soundcloud', async () => 'payload')

    expect(result).toBe('payload')
    expect(incrementMetric).toHaveBeenCalledExactlyOnceWith(
      'kranz_tv.server.proxy_request',
      { route: 'soundcloud', status: 'ok' },
    )
    expect(recordDistribution).toHaveBeenCalledExactlyOnceWith(
      'kranz_tv.server.proxy_ms',
      expect.any(Number),
      { route: 'soundcloud' },
    )
    expect(flushMetrics).toHaveBeenCalledOnce()
  })

  it('rethrows handler errors and emits status:error exactly once', async () => {
    const boom = new Error('upstream exploded')
    await expect(
      withProxyMetrics('youtube', async () => {
        throw boom
      }),
    ).rejects.toThrow('upstream exploded')

    expect(incrementMetric).toHaveBeenCalledExactlyOnceWith(
      'kranz_tv.server.proxy_request',
      { route: 'youtube', status: 'error' },
    )
    expect(recordDistribution).toHaveBeenCalledExactlyOnceWith(
      'kranz_tv.server.proxy_ms',
      expect.any(Number),
      { route: 'youtube' },
    )
  })

  it('records a non-negative latency', async () => {
    await withProxyMetrics('youtube', async () => 'ok')
    const [, elapsedMs] = vi.mocked(recordDistribution).mock.calls[0]
    expect(elapsedMs).toBeGreaterThanOrEqual(0)
  })

  it('never lets a metrics failure break the response', async () => {
    vi.mocked(incrementMetric).mockImplementation(() => {
      throw new Error('metrics down')
    })
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const result = await withProxyMetrics('soundcloud', async () => 42)

    expect(result).toBe(42)
    expect(consoleSpy).toHaveBeenCalledOnce()
    consoleSpy.mockRestore()
  })
})
