import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  incrementMetric,
  recordGauge,
  recordDistribution,
  flushMetrics,
} from '~/lib/datadog/worker-metrics'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  vi.stubEnv('DD_API_KEY', 'test-api-key')
  mockFetch.mockResolvedValue(new Response(null, { status: 202 }))
})

afterEach(async () => {
  await flushMetrics() // drain any leftover buffer between tests
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function bodyOfCall(i: number): {
  series: Array<Record<string, unknown>>
} {
  const call = mockFetch.mock.calls[i] as [string, { body: string }]
  return JSON.parse(call[1].body) as { series: Array<Record<string, unknown>> }
}

describe('flushMetrics', () => {
  it('no-ops without DD_API_KEY and still clears the buffer', async () => {
    vi.stubEnv('DD_API_KEY', '')
    incrementMetric('kranz_tv.server.channels_request')
    await flushMetrics()
    expect(mockFetch).not.toHaveBeenCalled()

    // buffer was cleared: configuring the key later must not resend old points
    vi.stubEnv('DD_API_KEY', 'test-api-key')
    await flushMetrics()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('no-ops with an empty buffer', async () => {
    await flushMetrics()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('posts counts and gauges to the v2 series endpoint with auth header', async () => {
    incrementMetric('kranz_tv.server.channels_request')
    recordGauge('kranz_tv.server.preset_channels', 30)
    await flushMetrics()

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ]
    expect(url).toBe('https://api.datadoghq.com/api/v2/series')
    expect(init.method).toBe('POST')
    expect(init.headers['DD-API-KEY']).toBe('test-api-key')
    expect(init.headers['Content-Type']).toBe('application/json')

    const { series } = bodyOfCall(0)
    expect(series).toHaveLength(2)
    expect(series[0]).toMatchObject({
      metric: 'kranz_tv.server.channels_request',
      type: 1, // count
    })
    expect(series[1]).toMatchObject({
      metric: 'kranz_tv.server.preset_channels',
      type: 3, // gauge
      points: [expect.objectContaining({ value: 30 })],
    })
  })

  it('posts distributions to the v1 distribution_points endpoint', async () => {
    recordDistribution('kranz_tv.server.channels_ms', 12.5)
    await flushMetrics()

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toBe('https://api.datadoghq.com/api/v1/distribution_points')
    const { series } = bodyOfCall(0)
    const points = series[0].points as [number, number[]][]
    expect(series[0].metric).toBe('kranz_tv.server.channels_ms')
    expect(points[0][1]).toEqual([12.5])
  })

  it('applies base tags plus formatted custom tags', async () => {
    incrementMetric('kranz_tv.server.channels_request', { route: 'channels' })
    await flushMetrics()

    const { series } = bodyOfCall(0)
    const tags = series[0].tags as string[]
    expect(tags).toContain('service:kranz-tv')
    expect(tags).toContain(`version:${__APP_VERSION__}`)
    expect(tags).toContain('route:channels')
    expect(tags.some((t) => t.startsWith('env:'))).toBe(true)
  })

  it('clears the buffer after a successful flush', async () => {
    incrementMetric('kranz_tv.server.channels_request')
    await flushMetrics()
    mockFetch.mockClear()
    await flushMetrics()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('never rejects when fetch fails, and logs the failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    incrementMetric('kranz_tv.server.channels_request')

    await expect(flushMetrics()).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('logs when Datadog rejects the payload', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 403 }))
    incrementMetric('kranz_tv.server.channels_request')

    await flushMetrics()
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
