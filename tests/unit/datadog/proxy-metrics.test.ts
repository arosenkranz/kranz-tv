import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withProxyMetrics } from '~/lib/datadog/proxy-metrics'
import { waitUntil } from '~/lib/runtime/wait-until'

vi.mock('~/lib/runtime/wait-until', () => ({
  waitUntil: vi.fn(),
}))

const SERIES_URL = 'https://api.datadoghq.com/api/v2/series'
const DISTRIBUTION_URL = 'https://api.datadoghq.com/api/v1/distribution_points'

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockResolvedValue(new Response(null, { status: 202 }))
  vi.stubGlobal('fetch', mockFetch)
  vi.stubEnv('DD_API_KEY', 'test-api-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function scheduledPromises(): Promise<void>[] {
  return vi
    .mocked(waitUntil)
    .mock.calls.map(([promise]) => promise as Promise<void>)
}

/** Parsed fetch bodies posted to the given Datadog endpoint so far. */
function postedBodies(
  url: string,
): Array<{ series: Array<Record<string, unknown>> }> {
  return mockFetch.mock.calls
    .filter(([callUrl]) => callUrl === url)
    .map(
      (call) =>
        JSON.parse((call[1] as { body: string }).body) as {
          series: Array<Record<string, unknown>>
        },
    )
}

async function drainSubmissions(): Promise<void> {
  await Promise.all(scheduledPromises())
}

describe('withProxyMetrics', () => {
  it('returns the handler result, emits status:ok, and registers the submission with waitUntil', async () => {
    const result = await withProxyMetrics('soundcloud', async () => 'payload')

    expect(result).toBe('payload')
    expect(waitUntil).toHaveBeenCalledOnce()
    await drainSubmissions()

    const [seriesBody] = postedBodies(SERIES_URL)
    expect(seriesBody.series).toHaveLength(1)
    expect(seriesBody.series[0].metric).toBe('kranz_tv.server.proxy_request')
    const tags = seriesBody.series[0].tags as string[]
    expect(tags).toContain('route:soundcloud')
    expect(tags).toContain('status:ok')

    const [distributionBody] = postedBodies(DISTRIBUTION_URL)
    expect(distributionBody.series).toHaveLength(1)
    expect(distributionBody.series[0].metric).toBe('kranz_tv.server.proxy_ms')
  })

  it('rethrows handler errors and emits status:error exactly once', async () => {
    const boom = new Error('upstream exploded')
    await expect(
      withProxyMetrics('youtube', async () => {
        throw boom
      }),
    ).rejects.toThrow('upstream exploded')

    expect(waitUntil).toHaveBeenCalledOnce()
    await drainSubmissions()

    const [seriesBody] = postedBodies(SERIES_URL)
    expect(seriesBody.series).toHaveLength(1)
    expect(seriesBody.series[0].metric).toBe('kranz_tv.server.proxy_request')
    const tags = seriesBody.series[0].tags as string[]
    expect(tags).toContain('route:youtube')
    expect(tags).toContain('status:error')
  })

  it('records a non-negative latency', async () => {
    await withProxyMetrics('youtube', async () => 'ok')
    await drainSubmissions()

    const [distributionBody] = postedBodies(DISTRIBUTION_URL)
    const points = distributionBody.series[0].points as [number, number[]][]
    expect(points[0][1][0]).toBeGreaterThanOrEqual(0)
  })

  it('schedules the submission without blocking the response', async () => {
    let resolveFetch!: (response: Response) => void
    mockFetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )

    const result = await withProxyMetrics('soundcloud', async () => 'payload')

    // The response resolves before the Datadog call completes.
    expect(result).toBe('payload')
    expect(waitUntil).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledTimes(2) // series + distribution

    resolveFetch(new Response(null, { status: 202 }))
    await drainSubmissions()
  })

  it('keeps concurrent requests isolated: each submission carries only its own points', async () => {
    // Two overlapping proxy requests whose handlers resolve in reverse order.
    const deferred: Array<(value: string) => void> = []
    const startWork = () =>
      new Promise<string>((resolve) => deferred.push(resolve))

    const first = withProxyMetrics('soundcloud', startWork)
    const second = withProxyMetrics('youtube', startWork)

    deferred[1]('youtube-response')
    deferred[0]('soundcloud-response')

    expect(await first).toBe('soundcloud-response')
    expect(await second).toBe('youtube-response')
    expect(waitUntil).toHaveBeenCalledTimes(2)
    await drainSubmissions()

    const seriesBodies = postedBodies(SERIES_URL)
    expect(seriesBodies).toHaveLength(2)
    for (const body of seriesBodies) {
      // Exactly one count point per request — nothing shared or stolen.
      expect(body.series).toHaveLength(1)
      expect(body.series[0].metric).toBe('kranz_tv.server.proxy_request')
    }
    const routes = seriesBodies.map((body) =>
      (body.series[0].tags as string[]).find((t) => t.startsWith('route:')),
    )
    expect(routes).toContain('route:soundcloud')
    expect(routes).toContain('route:youtube')

    const distributionBodies = postedBodies(DISTRIBUTION_URL)
    expect(distributionBodies).toHaveLength(2)
    for (const body of distributionBodies) {
      expect(body.series).toHaveLength(1)
      expect(body.series[0].metric).toBe('kranz_tv.server.proxy_ms')
    }
  })

  it('never lets a metrics failure break the response', async () => {
    vi.mocked(waitUntil).mockImplementation(() => {
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
