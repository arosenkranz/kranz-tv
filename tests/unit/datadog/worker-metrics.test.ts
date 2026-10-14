import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMetricsBatch } from '~/lib/datadog/worker-metrics'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  vi.stubEnv('DD_API_KEY', 'test-api-key')
  mockFetch.mockResolvedValue(new Response(null, { status: 202 }))
})

afterEach(() => {
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

describe('MetricsBatch.flush', () => {
  it('no-ops without DD_API_KEY and still clears the batch', async () => {
    vi.stubEnv('DD_API_KEY', '')
    const batch = createMetricsBatch()
    batch.increment('kranz_tv.server.channels_request')
    await batch.flush()
    expect(mockFetch).not.toHaveBeenCalled()

    // batch was cleared: configuring the key later must not resend old points
    vi.stubEnv('DD_API_KEY', 'test-api-key')
    await batch.flush()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('no-ops with an empty batch', async () => {
    const batch = createMetricsBatch()
    await batch.flush()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('posts counts and gauges to the v2 series endpoint with auth header', async () => {
    const batch = createMetricsBatch()
    batch.increment('kranz_tv.server.channels_request')
    batch.recordGauge('kranz_tv.server.preset_channels', 30)
    await batch.flush()

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
    const batch = createMetricsBatch()
    batch.recordDistribution('kranz_tv.server.channels_ms', 12.5)
    await batch.flush()

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toBe('https://api.datadoghq.com/api/v1/distribution_points')
    const { series } = bodyOfCall(0)
    const points = series[0].points as [number, number[]][]
    expect(series[0].metric).toBe('kranz_tv.server.channels_ms')
    expect(points[0][1]).toEqual([12.5])
  })

  it('applies base tags plus formatted custom tags', async () => {
    const batch = createMetricsBatch()
    batch.increment('kranz_tv.server.channels_request', { route: 'channels' })
    await batch.flush()

    const { series } = bodyOfCall(0)
    const tags = series[0].tags as string[]
    expect(tags).toContain('service:kranz-tv')
    expect(tags).toContain(`version:${__APP_VERSION__}`)
    expect(tags).toContain('route:channels')
    expect(tags.some((t) => t.startsWith('env:'))).toBe(true)
  })

  it('clears the batch after a successful flush', async () => {
    const batch = createMetricsBatch()
    batch.increment('kranz_tv.server.channels_request')
    await batch.flush()
    mockFetch.mockClear()
    await batch.flush()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('never rejects when fetch fails, and logs the failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    const batch = createMetricsBatch()
    batch.increment('kranz_tv.server.channels_request')

    await expect(batch.flush()).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('logs when Datadog rejects the payload', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 403 }))
    const batch = createMetricsBatch()
    batch.increment('kranz_tv.server.channels_request')

    await batch.flush()
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('never leaks the API key into failure logs', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    const batch = createMetricsBatch()
    batch.increment('kranz_tv.server.channels_request')

    await batch.flush()
    const logged = errorSpy.mock.calls.map((call) => JSON.stringify(call))
    expect(logged.join('\n')).not.toContain('test-api-key')
    errorSpy.mockRestore()
  })
})

describe('request isolation', () => {
  it('keeps batches isolated: one flush never sends another batch points', async () => {
    const soundcloud = createMetricsBatch()
    const youtube = createMetricsBatch()
    soundcloud.increment('kranz_tv.server.proxy_request', {
      route: 'soundcloud',
      status: 'ok',
    })
    youtube.increment('kranz_tv.server.proxy_request', {
      route: 'youtube',
      status: 'ok',
    })

    await soundcloud.flush()
    expect(mockFetch).toHaveBeenCalledOnce()
    const { series: first } = bodyOfCall(0)
    expect(first).toHaveLength(1)
    expect(
      (first[0].tags as string[]).some((t) => t === 'route:soundcloud'),
    ).toBe(true)

    await youtube.flush()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const { series: second } = bodyOfCall(1)
    expect(second).toHaveLength(1)
    expect(
      (second[0].tags as string[]).some((t) => t === 'route:youtube'),
    ).toBe(true)
  })

  it('falls back to env:production when DD_ENV is unset', async () => {
    const hadDdEnv = process.env.DD_ENV
    delete process.env.DD_ENV
    try {
      const batch = createMetricsBatch()
      batch.increment('kranz_tv.server.proxy_request')

      await batch.flush()

      const { series } = bodyOfCall(0)
      const tags = series[0].tags as string[]
      expect(tags).toContain('env:production')
    } finally {
      if (hadDdEnv !== undefined) process.env.DD_ENV = hadDdEnv
    }
  })

  it('tags env with the configured DD_ENV when present', async () => {
    vi.stubEnv('DD_ENV', 'staging')
    const batch = createMetricsBatch()
    batch.increment('kranz_tv.server.proxy_request')

    await batch.flush()

    const { series } = bodyOfCall(0)
    const tags = series[0].tags as string[]
    expect(tags).toContain('env:staging')
  })

  it('never rejects when fetch throws synchronously', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockImplementation(() => {
      throw new Error('fetch is not available')
    })
    const batch = createMetricsBatch()
    batch.increment('kranz_tv.server.proxy_request')

    await expect(batch.flush()).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith(
      '[worker-metrics] metric submission failed:',
      'fetch is not available',
    )
    errorSpy.mockRestore()
  })

  it('does not mix points across interleaved batches', async () => {
    const first = createMetricsBatch()
    const second = createMetricsBatch()

    first.increment('kranz_tv.server.proxy_request')
    const firstFlush = first.flush() // in flight while second batch records
    second.recordDistribution('kranz_tv.server.proxy_ms', 7)
    await firstFlush

    expect(mockFetch).toHaveBeenCalledOnce()
    const { series: sent } = bodyOfCall(0)
    expect(sent).toHaveLength(1)
    expect(sent[0].metric).toBe('kranz_tv.server.proxy_request')

    await second.flush()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const { series: secondSent } = bodyOfCall(1)
    expect(secondSent).toHaveLength(1)
    expect(secondSent[0].metric).toBe('kranz_tv.server.proxy_ms')
  })
})
